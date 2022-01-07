import { Dependencies } from '@rebel/server/context/context'
import ExperienceHelpers from '@rebel/server/helpers/ExperienceHelpers'
import { ChatItem } from '@rebel/server/models/chat'
import ExperienceStore, { ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { Eps, GreaterThanOrEqual, LessThan, NumRange, positiveInfinity, sum } from '@rebel/server/util/math'
import { calculateWalkingScore } from '@rebel/server/util/score'

export type Level = {
  level: GreaterThanOrEqual<0>,
  totalExperience: GreaterThanOrEqual<0>,
  levelProgress: GreaterThanOrEqual<0> & LessThan<1>
}

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  experienceStore: ExperienceStore
  experienceHelpers: ExperienceHelpers
  viewershipStore: ViewershipStore
}>

export default class ExperienceService {
  private readonly livestreamStore: LivestreamStore
  private readonly experienceStore: ExperienceStore
  private readonly experienceHelpers: ExperienceHelpers
  private readonly viewershipStore: ViewershipStore

  public static readonly CHAT_BASE_XP = 1000

  constructor (deps: Deps) {
    this.livestreamStore = deps.resolve('livestreamStore')
    this.experienceStore = deps.resolve('experienceStore')
    this.experienceHelpers = deps.resolve('experienceHelpers')
    this.viewershipStore = deps.resolve('viewershipStore')
  }

  // adds experience only for chat messages sent during the live chat
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
      await this.viewershipStore.addViewershipForChannel(channelId, chatItem.timestamp)
    }
  }

  public async getLevel (channelId: string): Promise<Level> {
    const totalExperience = await this.getTotalExperience(channelId)
    const level = this.experienceHelpers.calculateLevel(totalExperience)
    return {
      totalExperience,
      ...level
    }
  }

  private async getTotalExperience (channelId: string): Promise<GreaterThanOrEqual<0>> {
    const latestSnapshot = await this.experienceStore.getLatestSnapshot(channelId)
    if (latestSnapshot == null) {
      return 0
    }

    const transactions = await this.experienceStore.getTransactionsStartingAt(channelId, latestSnapshot.time.getTime())
    const totalDelta = sum(transactions.map(tx => tx.delta))
    const total = latestSnapshot.experience + totalDelta
    return total >= 0 ? total as GreaterThanOrEqual<0> : 0
  }

  private async getViewershipMultiplier (channelId: string): Promise<GreaterThanOrEqual<1>> {
    const streams = await this.viewershipStore.getLivestreamViewership(channelId)

    const viewershipScore = calculateWalkingScore(
      streams,
      0,
      stream => stream.viewed,
      (score, participated) => participated ? score + 1 : score - 1,
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

  private async getSpamMultiplier (chatItem: ChatItem): Promise<NumRange<Eps, 1>> {
    const prev = await this.experienceStore.getPreviousChatExperience(chatItem.author.channelId)
    if (prev == null || prev.livestream.id !== this.livestreamStore.currentLivestream.id) {
      // always start with a multiplier of 1 at the start of the livestream
      return 1 as NumRange<Eps, 1>
    }

    const currentTimestamp = chatItem.timestamp
    const prevTimestamp = prev.time.getTime()
    const prevSpamMultiplier = prev.experienceDataChatMessage.spamMultiplier as NumRange<Eps, 1>
    return this.experienceHelpers.calculateSpamMultiplier(currentTimestamp, prevTimestamp, prevSpamMultiplier)
  }

  private getMessageQualityMultiplier (chatItem: ChatItem): NumRange<0, 2> {
    const messageQuality = this.experienceHelpers.calculateChatMessageQuality(chatItem)
    return this.experienceHelpers.calculateQualityMultiplier(messageQuality)
  }
}
