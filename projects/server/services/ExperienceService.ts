import { ExperienceTransaction } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ExperienceHelpers, { LevelData, SpamMult } from '@rebel/server/helpers/ExperienceHelpers'
import { ChatItem } from '@rebel/server/models/chat'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ExperienceStore, { ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { sortBy, zip } from '@rebel/server/util/arrays'
import { asGte, GreaterThanOrEqual, LessThan, NumRange, positiveInfinity, sum } from '@rebel/server/util/math'
import { calculateWalkingScore } from '@rebel/server/util/score'

export type Level = {
  level: GreaterThanOrEqual<0>,
  totalExperience: GreaterThanOrEqual<0>,
  levelProgress: GreaterThanOrEqual<0> & LessThan<1>
}

export type LevelDiff = {
  timestamp: number // at what time the last level transition occurred
  channelId: number
  startLevel: Level
  endLevel: Level
}

export type RankedEntry = LevelData & {
  rank: number
  channelId: number
  channelName: string
}

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  experienceStore: ExperienceStore
  experienceHelpers: ExperienceHelpers
  viewershipStore: ViewershipStore
  channelStore: ChannelStore
}>

export default class ExperienceService extends ContextClass {
  private readonly livestreamStore: LivestreamStore
  private readonly experienceStore: ExperienceStore
  private readonly experienceHelpers: ExperienceHelpers
  private readonly viewershipStore: ViewershipStore
  private readonly channelStore: ChannelStore

  public static readonly CHAT_BASE_XP = 1000

  constructor (deps: Deps) {
    super()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.experienceStore = deps.resolve('experienceStore')
    this.experienceHelpers = deps.resolve('experienceHelpers')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.channelStore = deps.resolve('channelStore')
  }

  /** Adds experience only for chat messages sent during the live chat.
   * Duplicate experience for the same chat message is checked on a database level. */
  public async addExperienceForChat (chatItems: ChatItem[]): Promise<void> {
    chatItems.sort((a, b) => a.timestamp - b.timestamp)

    for (const chatItem of chatItems) {
      // ensure that stream is live
      const time = new Date(chatItem.timestamp)
      const streamStartTime = this.livestreamStore.currentLivestream.start
      const streamEndTime = this.livestreamStore.currentLivestream.end
      if (streamStartTime == null || time < streamStartTime || streamEndTime != null && time > streamEndTime) {
        continue
      }

      const channelId = chatItem.author.channelId

      const viewershipStreakMultiplier = await this.getViewershipMultiplier(channelId)
      const participationStreakMultiplier = await this.getParticipationMultiplier(channelId)
      const spamMultiplier = await this.getSpamMultiplier(chatItem)
      const messageQualityMultiplier = this.getMessageQualityMultiplier(chatItem)
      const data: ChatExperienceData = {
        viewershipStreakMultiplier,
        participationStreakMultiplier,
        spamMultiplier,
        messageQualityMultiplier,
        baseExperience: ExperienceService.CHAT_BASE_XP,
        chatMessageYtId: chatItem.id
      }

      const totalMultiplier = viewershipStreakMultiplier * participationStreakMultiplier * spamMultiplier * messageQualityMultiplier
      const xpAmount = Math.round(ExperienceService.CHAT_BASE_XP * totalMultiplier)
      await this.experienceStore.addChatExperience(channelId, chatItem.timestamp, xpAmount, data)
    }
  }

  /** Sorted in ascending order. */
  public async getLeaderboard (): Promise<RankedEntry[]> {
    const allChannels = await this.channelStore.getCurrentChannelNames()
    const allLevels = await Promise.all(allChannels.map(channel => this.getLevel(channel.id)))
    const ordered = sortBy(zip(allChannels, allLevels), item => item.totalExperience, 'desc')
    return ordered.map((item, i) => ({
      rank: i + 1,
      channelId: item.id,
      channelName: item.name,
      level: item.level,
      levelProgress: item.levelProgress
    }))
  }

  public async getLevel (channelId: number): Promise<Level> {
    const totalExperience = await this.getTotalExperience(channelId)
    const level = this.experienceHelpers.calculateLevel(totalExperience)
    return {
      totalExperience,
      ...level
    }
  }

  /** Returns the level difference between now and the start time (inclusive) for
   * each channel, where there is a difference of at least 1. */
  public async getLevelDiffs (startTime: number): Promise<LevelDiff[]> {
    const transactions = await this.experienceStore.getAllTransactionsStartingAt(startTime)
    if (transactions.length === 0) {
      return []
    }

    const channelTxs: Map<number, ExperienceTransaction[]> = new Map()
    for (const tx of transactions) {
      const channelId = tx.channel.id
      if (!channelTxs.has(channelId)) {
        channelTxs.set(channelId, [])
      }

      channelTxs.get(channelId)!.push(tx)
    }

    const diffs: LevelDiff[] = []
    for (const [channelId, txs] of channelTxs) {
      if (txs.length === 0) {
        continue
      }

      const endXp = await this.getTotalExperience(channelId)
      // this was the experience *before the starting tx*
      const startXp = asGte(endXp - sum(txs.map(tx => tx.delta)), 0)
      const startLevel = this.experienceHelpers.calculateLevel(startXp)
      const endLevel = this.experienceHelpers.calculateLevel(endXp)
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
        channelId: channelId,
        timestamp: transitionTime!,
        startLevel: { ...startLevel, totalExperience: startXp },
        endLevel: { ...endLevel, totalExperience: endXp }
      })
    }

    return diffs
  }

  public async modifyExperience (channelId: number, levelDelta: number, message: string | null): Promise<Level> {
    const currentExperience = await this.getTotalExperience(channelId)
    const currentLevel = this.experienceHelpers.calculateLevel(currentExperience)
    const currentLevelFrac = currentLevel.level + currentLevel.levelProgress

    const requiredExperience = this.experienceHelpers.calculateExperience(currentLevelFrac + levelDelta)
    const experienceDelta = requiredExperience - currentExperience
    await this.experienceStore.addManualExperience(channelId, experienceDelta, message)

    const updatedLevel = await this.getLevel(channelId)
    return updatedLevel
  }

  private async getTotalExperience (channelId: number): Promise<GreaterThanOrEqual<0>> {
    const snapshot = await this.experienceStore.getSnapshot(channelId)
    const baseExperience = snapshot?.experience ?? 0

    const startingTime = snapshot?.time.getTime() ?? 0
    const totalDelta = await this.experienceStore.getTotalDeltaStartingAt(channelId, startingTime)
    const total = baseExperience + totalDelta
    return total >= 0 ? total as GreaterThanOrEqual<0> : 0
  }

  private async getViewershipMultiplier (channelId: string): Promise<GreaterThanOrEqual<1>> {
    const streams = await this.viewershipStore.getLivestreamViewership(channelId)

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

  private async getParticipationMultiplier (channelId: string): Promise<GreaterThanOrEqual<1>> {
    const streams = await this.viewershipStore.getLivestreamParticipation(channelId)

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

  private async getSpamMultiplier (chatItem: ChatItem): Promise<SpamMult> {
    const prev = await this.experienceStore.getPreviousChatExperience(chatItem.author.channelId)
    if (prev == null || prev.livestream.id !== this.livestreamStore.currentLivestream.id) {
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
}
