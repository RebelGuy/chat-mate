import { ExperienceTransaction } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ExperienceHelpers, { LevelData, RepetitionPenalty, SpamMult } from '@rebel/server/helpers/ExperienceHelpers'
import { ChatItem, getExternalId } from '@rebel/server/models/chat'
import ChannelService, { getUserName } from '@rebel/server/services/ChannelService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ExperienceStore, { ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { sortBy, zip, zipOnStrict } from '@rebel/server/util/arrays'
import { asGte, asLt, clamp, GreaterThanOrEqual, LessThan, NumRange, positiveInfinity, sum } from '@rebel/server/util/math'
import { calculateWalkingScore } from '@rebel/server/util/score'
import { single } from '@rebel/server/util/arrays'

export type Level = {
  level: GreaterThanOrEqual<0>,
  totalExperience: GreaterThanOrEqual<0>,
  /** Linear progress. For example, 0.5 signifies that half of the experience between the current level and the next has been collected. */
  levelProgress: GreaterThanOrEqual<0> & LessThan<1>
}

export type UserLevel = {
  userId: number
  level: Level
}

export type LevelDiff = {
  timestamp: number // at what time the last level transition occurred
  userId: number
  startLevel: Level
  endLevel: Level
}

export type RankedEntry = LevelData & {
  rank: number
  userId: number
  userName: string
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
  }

  /** Adds experience only for chat messages sent during the livestream for unpunished users.
   * Duplicate experience for the same chat message is checked on a database level. */
  public async addExperienceForChat (chatItem: ChatItem): Promise<void> {
    // ensure that an active public stream exists and is live
    const livestream = this.livestreamStore.activeLivestream
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
    const userId = await this.channelStore.getUserId(externalId)
    const isPunished = await this.punishmentService.isUserPunished(userId)
    if (isPunished) {
      return
    }

    const viewershipStreakMultiplier = await this.getViewershipMultiplier(userId)
    const participationStreakMultiplier = await this.getParticipationMultiplier(userId)
    const spamMultiplier = await this.getSpamMultiplier(livestream.id, chatItem, userId)
    const messageQualityMultiplier = this.getMessageQualityMultiplier(chatItem)
    const repetitionPenalty = await this.getMessageRepetitionPenalty(time.getTime(), userId)
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
    await this.experienceStore.addChatExperience(userId, chatItem.timestamp, xpAmount, data)
  }

  /** Sorted in ascending order. */
  public async getLeaderboard (): Promise<RankedEntry[]> {
    const userNames = await this.channelService.getActiveUserChannels('all')
    const userLevels = await this.getLevels(userNames.map(user => user.channel.userId))

    const orderedUserLevelChannels = zipOnStrict(userLevels, userNames, 'userId')
    return orderedUserLevelChannels.map((item, i) => ({
      rank: i + 1,
      userId: item.channel.userId,
      userName: getUserName(item),
      level: item.level.level,
      levelProgress: item.level.levelProgress
    }))
  }

  /** Sorted in descending order by experience. */
  public async getLevels (userIds: number[]): Promise<UserLevel[]> {
    const userExperiences = await this.experienceStore.getExperience(userIds)

    return userExperiences.map(xp => {
      const totalExperience = clamp(xp.experience, 0, null)
      const level = this.experienceHelpers.calculateLevel(totalExperience)
      return {
        userId: xp.userId,
        level: {
          totalExperience: totalExperience,
          ...level
        }
      }
    })
  }

  /** Returns the level difference between now and the start time (inclusive) for
   * each channel, where there is a difference of at least 1. */
  public async getLevelDiffs (startTime: number): Promise<LevelDiff[]> {
    const transactions = await this.experienceStore.getAllTransactionsStartingAt(startTime)
    if (transactions.length === 0) {
      return []
    }

    const userTxs: Map<number, ExperienceTransaction[]> = new Map()
    for (const tx of transactions) {
      const userId = tx.userId
      if (!userTxs.has(userId)) {
        userTxs.set(userId, [])
      }

      userTxs.get(userId)!.push(tx)
    }

    const userExperiences = await this.experienceStore.getExperience([...userTxs.keys()])
    const diffs: LevelDiff[] = []
    for (const [userId, txs] of userTxs) {
      if (txs.length === 0) {
        continue
      }

      const endXp = userExperiences.find(x => x.userId === userId)!.experience
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
        userId: userId,
        timestamp: transitionTime!,
        startLevel: { ...startLevel, totalExperience: startXp },
        endLevel: { ...endLevel, totalExperience: asGte(endXp, 0) }
      })
    }

    return diffs
  }

  public async modifyExperience (userId: number, levelDelta: number, message: string | null): Promise<UserLevel> {
    const currentExperiences = await this.experienceStore.getExperience([userId])

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
    await this.experienceStore.addManualExperience(userId, experienceDelta, message)

    const updatedLevel = await this.getLevels([userId])
    return single(updatedLevel)
  }

  private async getViewershipMultiplier (userId: number): Promise<GreaterThanOrEqual<1>> {
    const streams = await this.viewershipStore.getLivestreamViewership(userId)

    const viewershipScore = calculateWalkingScore(
      streams,
      0,
      stream => stream.viewed,
      (score, viewed) => viewed ? score + 1 : score - 1,
      0,
      positiveInfinity
    )

    return this.experienceHelpers.calculateViewershipMultiplier(viewershipScore)
  }

  private async getParticipationMultiplier (userId: number): Promise<GreaterThanOrEqual<1>> {
    const streams = await this.viewershipStore.getLivestreamParticipation(userId)

    const participationScore = calculateWalkingScore(
      streams,
      0,
      stream => stream.participated,
      (score, participated) => participated ? score + 1 : score - 1,
      0,
      positiveInfinity
    )

    return this.experienceHelpers.calculateParticipationMultiplier(participationScore)
  }

  private async getSpamMultiplier (currentLivestreamId: number, chatItem: ChatItem, userId: number): Promise<SpamMult> {
    const prev = await this.experienceStore.getPreviousChatExperience(userId)
    if (prev == null || prev.experienceDataChatMessage.chatMessage.livestreamId !== currentLivestreamId) {
      // always start with a multiplier of 1 at the start of the livestream
      return 1 as SpamMult
    }

    const currentTimestamp = chatItem.timestamp
    const prevTimestamp = prev.time.getTime()
    const prevSpamMultiplier = prev.experienceDataChatMessage.spamMultiplier as SpamMult
    return this.experienceHelpers.calculateSpamMultiplier(currentTimestamp, prevTimestamp, prevSpamMultiplier)
  }

  private getMessageQualityMultiplier (chatItem: ChatItem): NumRange<0, 2> {
    const messageQuality = this.experienceHelpers.calculateChatMessageQuality(chatItem)
    return this.experienceHelpers.calculateQualityMultiplier(messageQuality)
  }

  private async getMessageRepetitionPenalty (currentTimestamp: number, userId: number): Promise<RepetitionPenalty> {
    const chat = await this.chatStore.getChatSince(currentTimestamp - 60000)
    return this.experienceHelpers.calculateRepetitionPenalty(currentTimestamp, chat.filter(c => c.userId === userId))
  }
}
