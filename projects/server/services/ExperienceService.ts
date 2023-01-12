import { ExperienceTransaction } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ExperienceHelpers, { LevelData, RepetitionPenalty, SpamMult } from '@rebel/server/helpers/ExperienceHelpers'
import { ChatItem, convertInternalMessagePartsToExternal, getExternalId, PartialChatMessage } from '@rebel/server/models/chat'
import ChannelService, { getUserName } from '@rebel/server/services/ChannelService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ExperienceStore, { ChatExperience, ChatExperienceData, ModifyChatExperienceArgs } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { sortBy, zip, zipOnStrict } from '@rebel/server/util/arrays'
import { asGte, asLt, clamp, GreaterThanOrEqual, LessThan, NumRange, positiveInfinity, sum } from '@rebel/server/util/math'
import { calculateWalkingScore } from '@rebel/server/util/score'
import { single } from '@rebel/server/util/arrays'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankHelpers from '@rebel/server/helpers/RankHelpers'
import AccountService, { getPrimaryUserId } from '@rebel/server/services/AccountService'

export type Level = {
  level: GreaterThanOrEqual<0>,
  totalExperience: GreaterThanOrEqual<0>,
  /** Linear progress. For example, 0.5 signifies that half of the experience between the current level and the next has been collected. */
  levelProgress: GreaterThanOrEqual<0> & LessThan<1>
}

export type UserLevel = {
  primaryUserId: number
  level: Level
}

export type LevelDiff = {
  timestamp: number // at what time the last level transition occurred
  primaryUserId: number
  startLevel: Level
  endLevel: Level
}

export type RankedEntry = LevelData & {
  rank: number
  primaryUserId: number
  channel: UserChannel
}

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  experienceStore: ExperienceStore
  experienceHelpers: ExperienceHelpers
  viewershipStore: ViewershipStore
  channelStore: ChannelStore
  chatStore: ChatStore
  channelService: ChannelService
  punishmentService: PunishmentService
  accountStore: AccountStore
  rankHelpers: RankHelpers
  accountService: AccountService
}>

export default class ExperienceService extends ContextClass {
  private readonly livestreamStore: LivestreamStore
  private readonly experienceStore: ExperienceStore
  private readonly experienceHelpers: ExperienceHelpers
  private readonly viewershipStore: ViewershipStore
  private readonly channelStore: ChannelStore
  private readonly chatStore: ChatStore
  private readonly channelService: ChannelService
  private readonly punishmentService: PunishmentService
  private readonly accountStore: AccountStore
  private readonly rankHelpers: RankHelpers
  private readonly accountService: AccountService

  public static readonly CHAT_BASE_XP = 1000

  constructor (deps: Deps) {
    super()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.experienceStore = deps.resolve('experienceStore')
    this.experienceHelpers = deps.resolve('experienceHelpers')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.channelStore = deps.resolve('channelStore')
    this.chatStore = deps.resolve('chatStore')
    this.channelService = deps.resolve('channelService')
    this.punishmentService = deps.resolve('punishmentService')
    this.accountStore = deps.resolve('accountStore')
    this.rankHelpers = deps.resolve('rankHelpers')
    this.accountService = deps.resolve('accountService')
  }

  /** Adds experience only for chat messages sent during the livestream for unpunished users.
   * Duplicate experience for the same chat message is checked on a database level. */
  public async addExperienceForChat (chatItem: ChatItem, streamerId: number): Promise<void> {
    // ensure that an active public stream exists and is live
    const livestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (livestream == null) {
      return
    }
    const time = new Date(chatItem.timestamp)
    const streamStartTime = livestream.start
    const streamEndTime = livestream.end
    if (streamStartTime == null || time < streamStartTime || streamEndTime != null && time > streamEndTime) {
      return
    }

    const externalId = getExternalId(chatItem)
    const primaryUserId = await this.channelStore.getPrimaryUserId(externalId)
    const connectedUserIds = single(await this.accountStore.getConnectedChatUserIds([primaryUserId])).connectedChatUserIds
    const isPunished = await this.punishmentService.isUserPunished(primaryUserId, streamerId)
    if (isPunished) {
      return
    }

    const viewershipStreakMultiplier = await this.getViewershipMultiplier(streamerId, connectedUserIds)
    const participationStreakMultiplier = await this.getParticipationMultiplier(streamerId, connectedUserIds)
    const prevChatExperience = await this.experienceStore.getPreviousChatExperience(streamerId, primaryUserId, null)
    const spamMultiplier = this.getSpamMultiplier(livestream.id, prevChatExperience, chatItem.timestamp)
    const messageQualityMultiplier = this.getMessageQualityMultiplier(chatItem.messageParts)
    const repetitionPenalty = await this.getMessageRepetitionPenalty(streamerId, time.getTime(), connectedUserIds)
    const data: ChatExperienceData = {
      viewershipStreakMultiplier,
      participationStreakMultiplier,
      spamMultiplier,
      messageQualityMultiplier,
      repetitionPenalty,
      baseExperience: ExperienceService.CHAT_BASE_XP,
      externalId: chatItem.id
    }

    // the message quality multiplier is applied to the end so that it amplifies any negative multiplier.
    // this is because multipliers can only be negative if there is a repetition penalty, but "high quality"
    // repetitive messages are anything but high quality, and thus receive a bigger punishment.
    const totalMultiplier = (viewershipStreakMultiplier * participationStreakMultiplier * spamMultiplier + repetitionPenalty) * messageQualityMultiplier
    const xpAmount = Math.round(ExperienceService.CHAT_BASE_XP * totalMultiplier)
    await this.experienceStore.addChatExperience(streamerId, primaryUserId, chatItem.timestamp, xpAmount, data)
  }

  /** Sorted in ascending order. */
  public async getLeaderboard (streamerId: number): Promise<RankedEntry[]> {
    const userChannels = await this.channelService.getActiveUserChannels(streamerId, null)
    const userLevels = await this.getLevels(streamerId, userChannels.map(getPrimaryUserId))

    return userLevels.map<RankedEntry>((userLevel, i) => {
      const channel = userChannels.find(c => getPrimaryUserId(c) === userLevel.primaryUserId)
      if (channel == null) {
        throw new Error(`Could not find channel for primary user ${userLevel.primaryUserId}`)
      }

      return {
        rank: i + 1,
        primaryUserId: userLevel.primaryUserId,
        channel: channel,
        level: userLevel.level.level,
        levelProgress: userLevel.level.levelProgress
      }
    })
  }

  /** Sorted in descending order by experience. */
  public async getLevels (streamerId: number, primaryUserIds: number[]): Promise<UserLevel[]> {
    const userExperiences = await this.experienceStore.getExperience(streamerId, primaryUserIds)

    return userExperiences.map(xp => {
      const totalExperience = clamp(xp.experience, 0, null)
      const level = this.experienceHelpers.calculateLevel(totalExperience)
      return {
        primaryUserId: xp.primaryUserId,
        level: {
          totalExperience: totalExperience,
          ...level
        }
      }
    })
  }

  /** Returns the level difference since the given timestamp, where there is a level difference of at least 1. */
  public async getLevelDiffs (streamerId: number, since: number): Promise<LevelDiff[]> {
    const primaryUserIds = await this.accountService.getStreamerPrimaryUserIds(streamerId)
    const transactions = await this.experienceStore.getAllTransactionsStartingAt(streamerId, primaryUserIds, since + 1)
    if (transactions.length === 0) {
      return []
    }

    // all users hereforth are primary users - we can compare them without requiring intermediate transformations
    const userTxs: Map<number, ExperienceTransaction[]> = new Map()
    for (const tx of transactions) {
      const userId = tx.userId
      if (!userTxs.has(userId)) {
        userTxs.set(userId, [])
      }

      userTxs.get(userId)!.push(tx)
    }

    const userExperiences = await this.experienceStore.getExperience(streamerId, [...userTxs.keys()])
    const diffs: LevelDiff[] = []
    for (const [userId, txs] of userTxs) {
      if (txs.length === 0) {
        continue
      }

      const endXp = userExperiences.find(x => x.primaryUserId === userId)!.experience
      const totalDelta = sum(txs.map(tx => tx.delta))
      if (endXp <= 0 || totalDelta <= 0 || endXp - totalDelta < 0) {
        // these are unusual edge cases that we get only when playing around with negative xp, especially at low levels, e.g. for spammers
        continue
      }

      // this was the experience *before the starting tx*
      const startXp = asGte(endXp - totalDelta, 0)
      const startLevel = this.experienceHelpers.calculateLevel(startXp)
      const endLevel = this.experienceHelpers.calculateLevel(asGte(endXp, 0))
      if (startLevel.level >= endLevel.level) {
        continue
      }

      // find the time at which the level transaction occurred.
      let transitionTime: number
      let runningXp = endXp
      for (let i = txs.length - 1; i >= 0; i--) {
        runningXp -= txs[i].delta
        if (i === 0 || this.experienceHelpers.calculateLevel(asGte(runningXp, 0)).level < endLevel.level) {
          transitionTime = txs[i].time.getTime()
          break
        }
      }

      diffs.push({
        primaryUserId: userId,
        timestamp: transitionTime!,
        startLevel: { ...startLevel, totalExperience: startXp },
        endLevel: { ...endLevel, totalExperience: asGte(endXp, 0) }
      })
    }

    return diffs
  }

  public async modifyExperience (primaryUserId: number, streamerId: number, loggedInRegisteredUserId: number, levelDelta: number, message: string | null): Promise<UserLevel> {
    const currentExperiences = await this.experienceStore.getExperience(streamerId, [primaryUserId])

    // current experience may be negative - this is intentional
    const currentExperience = single(currentExperiences).experience
    const effectiveExperience = clamp(currentExperience, 0, null)
    const currentLevel = this.experienceHelpers.calculateLevel(effectiveExperience)
    const currentLevelFrac = currentLevel.level + currentLevel.levelProgress
    const newLevelFrac = Math.max(0, currentLevelFrac + levelDelta)

    const newLevel = Math.floor(newLevelFrac)
    const newLevelProgress = newLevelFrac - newLevel
    const newLevelData: LevelData = {
      level: asGte(newLevel, 0),
      levelProgress: asLt(asGte(newLevelProgress, 0), 1)
    }
    const requiredExperience = Math.round(this.experienceHelpers.calculateExperience(newLevelData))
    const experienceDelta = requiredExperience - currentExperience
    await this.experienceStore.addManualExperience(streamerId, primaryUserId, loggedInRegisteredUserId, experienceDelta, message)

    const updatedLevel = await this.getLevels(streamerId, [primaryUserId])
    return single(updatedLevel)
  }

  public async recalculateChatExperience (aggregateUserId: number) {
    const connectedUserIds = single(await this.accountStore.getConnectedChatUserIds([aggregateUserId])).connectedChatUserIds
    const primaryUserId = connectedUserIds[0]
    const streamerIds = await this.experienceStore.getChatExperienceStreamerIdsForUser(aggregateUserId)

    for (const streamerId of streamerIds) {
      // this may need to be optimised in the future (chunk-wise processing). I'd estimate it works fine for up to 1k-10k experience txs/chat messages
      const punishments = (await Promise.all(connectedUserIds.map(userId => this.punishmentService.getPunishmentHistory(userId, streamerId)))).flatMap(x => x)
      const chatExperienceTxs = await this.experienceStore.getAllUserChatExperience(streamerId, aggregateUserId)
      const chatMessages = await Promise.all(chatExperienceTxs.map(tx => this.chatStore.getChatById(tx.experienceDataChatMessage.chatMessageId)))

      let args: ModifyChatExperienceArgs[] = []
      for (const tx of chatExperienceTxs) {
        const time = tx.time
        const livestreamId = tx.experienceDataChatMessage.chatMessage.livestreamId
        const chatMessage = chatMessages.find(msg => msg.id === tx.experienceDataChatMessage.chatMessageId)!

        if (livestreamId == null) {
          // todo: 0 xp
          continue
        }

        const isPunished = punishments.find(p => this.rankHelpers.isRankActive(p, time)) != null
        if (isPunished) {
          // todo: 0 xp
          continue
        }

        const viewershipStreakMultiplier = await this.getViewershipMultiplier(streamerId, connectedUserIds)
        const participationStreakMultiplier = await this.getParticipationMultiplier(streamerId, connectedUserIds)
        const prevChatExperience = await this.experienceStore.getPreviousChatExperience(streamerId, primaryUserId, tx.id)
        const spamMultiplier = this.getSpamMultiplier(livestreamId, prevChatExperience, time.getTime())
        const messageParts = convertInternalMessagePartsToExternal(chatMessage.chatMessageParts)
        const messageQualityMultiplier = this.getMessageQualityMultiplier(messageParts)
        const repetitionPenalty = await this.getMessageRepetitionPenalty(streamerId, time.getTime(), connectedUserIds)

        // the message quality multiplier is applied to the end so that it amplifies any negative multiplier.
        // this is because multipliers can only be negative if there is a repetition penalty, but "high quality"
        // repetitive messages are anything but high quality, and thus receive a bigger punishment.
        const totalMultiplier = (viewershipStreakMultiplier * participationStreakMultiplier * spamMultiplier + repetitionPenalty) * messageQualityMultiplier
        const xpAmount = Math.round(ExperienceService.CHAT_BASE_XP * totalMultiplier)

        args.push({
          experienceTransactionId: tx.id,
          chatExperienceDataId: tx.experienceDataChatMessage.id,
          delta: xpAmount,
          baseExperience: ExperienceService.CHAT_BASE_XP,
          viewershipStreakMultiplier,
          participationStreakMultiplier,
          spamMultiplier,
          messageQualityMultiplier,
          repetitionPenalty
        })
      }
      await this.experienceStore.modifyChatExperiences(args)
    }
  }

  private async getViewershipMultiplier (streamerId: number, anyUserIds: number[]): Promise<GreaterThanOrEqual<1>> {
    const streams = await this.viewershipStore.getLivestreamViewership(streamerId, anyUserIds)

    const viewershipScore = calculateWalkingScore(
      streams,
      0,
      stream => stream.viewed,
      (score, viewed) => viewed ? score + 1 : score - 1,
      0,
      10
    )

    return this.experienceHelpers.calculateViewershipMultiplier(viewershipScore)
  }

  private async getParticipationMultiplier (streamerId: number, anyUserIds: number[]): Promise<GreaterThanOrEqual<1>> {
    const streams = await this.viewershipStore.getLivestreamParticipation(streamerId, anyUserIds)

    const participationScore = calculateWalkingScore(
      streams,
      0,
      stream => stream.participated,
      (score, participated) => participated ? score + 1 : score - 1,
      0,
      10
    )

    return this.experienceHelpers.calculateParticipationMultiplier(participationScore)
  }

  // uses the primary user id because we only need it to fatch a experience transaction, and experience should be linked to the primary user at the time of calling this function
  private getSpamMultiplier (currentLivestreamId: number, prevChatExperience: ChatExperience | null, messageTimestamp: number): SpamMult {
    if (prevChatExperience == null || prevChatExperience.experienceDataChatMessage.chatMessage.livestreamId !== currentLivestreamId) {
      // always start with a multiplier of 1 at the start of the livestream
      return 1 as SpamMult
    }

    const prevTimestamp = prevChatExperience.time.getTime()
    const prevSpamMultiplier = prevChatExperience.experienceDataChatMessage.spamMultiplier as SpamMult
    return this.experienceHelpers.calculateSpamMultiplier(messageTimestamp, prevTimestamp, prevSpamMultiplier)
  }

  private getMessageQualityMultiplier (messageParts: PartialChatMessage[]): NumRange<0, 2> {
    const messageQuality = this.experienceHelpers.calculateChatMessageQuality(messageParts)
    return this.experienceHelpers.calculateQualityMultiplier(messageQuality)
  }

  private async getMessageRepetitionPenalty (streamerId: number, currentTimestamp: number, userIds: number[]): Promise<RepetitionPenalty> {
    const chat = await this.chatStore.getChatSince(streamerId, currentTimestamp - 60000, currentTimestamp)
    return this.experienceHelpers.calculateRepetitionPenalty(currentTimestamp, chat.filter(c => c.userId != null && userIds.includes(c.userId)))
  }
}
