import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import ExperienceService from '@rebel/server/services/ExperienceService'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { sortBy, unique } from '@rebel/shared/util/arrays'
import ChatStore from '@rebel/server/stores/ChatStore'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import RankStore from '@rebel/server/stores/RankStore'
import { ExternalRank, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { IgnoreOptions } from '@rebel/server/services/rank/ModService'
import DonationService, { DonationWithMessage } from '@rebel/server/services/DonationService'

export type ChatMateEvent = { timestamp: number } & ({
  type: 'levelUp'
  oldLevel: number
  newLevel: number
  primaryUserId: number
} | {
  type: 'newTwitchFollower'
  displayName: string
} | {
  type: 'donation'
  donation: DonationWithMessage
  primaryUserId: number | null
} | {
  type: 'newViewer'
  primaryUserId: number
} | {
  type: 'chatMessageDeleted'
  chatMessageId: number
} | {
  type: 'rankUpdate'
  primaryUserId: number
  appliedByPrimaryUserId: number | null
  isAdded: boolean
  rankName: ExternalRank
  youtubeRankResults: YoutubeRankResult[]
  twitchRankResults: TwitchRankResult[]
  ignoreOptions: IgnoreOptions | null
})

type Deps = Dependencies<{
  experienceService: ExperienceService
  followerStore: FollowerStore
  donationService: DonationService
  chatStore: ChatStore
  rankStore: RankStore
}>

export default class ChatMateEventService extends ContextClass {
  private readonly experienceService: ExperienceService
  private readonly followerStore: FollowerStore
  private readonly donationService: DonationService
  private readonly chatStore: ChatStore
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super()
    this.experienceService = deps.resolve('experienceService')
    this.followerStore = deps.resolve('followerStore')
    this.donationService = deps.resolve('donationService')
    this.chatStore = deps.resolve('chatStore')
    this.rankStore = deps.resolve('rankStore')
  }

  public async getEventsSince (streamerId: number, since: number): Promise<ChatMateEvent[]> {
    let events: ChatMateEvent[] = []

    const diffs = await this.experienceService.getLevelDiffs(streamerId, since)
    for (let i = 0; i < diffs.length; i++) {
      const diff = diffs[i]

      events.push({
        type: 'levelUp',
        timestamp: diff.timestamp,
        newLevel: diff.endLevel.level,
        oldLevel: diff.startLevel.level,
        primaryUserId: diff.primaryUserId
      })
    }

    const newFollowers = await this.followerStore.getFollowersSince(streamerId, since)
    for (let i = 0; i < newFollowers.length; i++) {
      const follower = newFollowers[i]
      events.push({
        type: 'newTwitchFollower',
        timestamp: follower.date.getTime(),
        displayName: follower.displayName
      })
    }

    const newDonations = await this.donationService.getDonationsSince(streamerId, since, false)
    for (let i = 0; i < newDonations.length; i++) {
      const donation = newDonations[i]
      events.push({
        type: 'donation',
        timestamp: donation.time.getTime(),
        donation: donation,
        primaryUserId: donation.primaryUserId
      })
    }

    const newMessages = await this.chatStore.getChatSince(streamerId, since)
    const primaryUserIds = unique(newMessages.map(msg => getPrimaryUserId(msg.user!)))
    const newViewers = await this.chatStore.getTimeOfFirstChat(streamerId, primaryUserIds)
    for (let i = 0; i < newViewers.length; i++) {
      const viewer = newViewers[i]
      const message = newMessages.find(msg => getPrimaryUserId(msg.user!) === viewer.primaryUserId)!
      if (viewer.firstSeen < message.time.getTime()) {
        // this is not the first message of the user
        continue
      }

      events.push({
        type: 'newViewer',
        timestamp: viewer.firstSeen,
        primaryUserId: viewer.primaryUserId
      })
    }

    const newDeletedMessages = await this.chatStore.getChatSince(streamerId, since, undefined, undefined, undefined, true)
    for (let i = 0; i < newDeletedMessages.length; i++) {
      events.push({
        type: 'chatMessageDeleted',
        timestamp: newDeletedMessages[i].deletedTime!.getTime(),
        chatMessageId: newDeletedMessages[i].id
      })
    }

    const rankEvents = await this.rankStore.getRankEventsSince(streamerId, since)
    for (const rankEvent of rankEvents) {
      events.push({
        type: 'rankUpdate',
        timestamp: rankEvent.time.getTime(),
        primaryUserId: rankEvent.userId,
        appliedByPrimaryUserId: rankEvent.appliedByUserId,
        rankName: rankEvent.rank.name as ExternalRank,
        isAdded: rankEvent.isAdded,
        youtubeRankResults: rankEvent.data?.youtubeRankResults ?? [],
        twitchRankResults: rankEvent.data?.twitchRankResults ?? [],
        ignoreOptions: rankEvent.data?.ignoreOptions ?? null
      })
    }

    return sortBy(events, e => e.timestamp)
  }
}
