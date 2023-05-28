import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import ExperienceService from '@rebel/server/services/ExperienceService'
import DonationStore, { DonationWithMessage } from '@rebel/server/stores/DonationStore'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { sortBy, unique } from '@rebel/shared/util/arrays'
import ChatStore from '@rebel/server/stores/ChatStore'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'

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
})

type Deps = Dependencies<{
  experienceService: ExperienceService
  followerStore: FollowerStore
  donationStore: DonationStore
  chatStore: ChatStore
}>

export default class ChatMateEventService extends ContextClass {
  private readonly experienceService: ExperienceService
  private readonly followerStore: FollowerStore
  private readonly donationStore: DonationStore
  private readonly chatStore: ChatStore

  constructor (deps: Deps) {
    super()
    this.experienceService = deps.resolve('experienceService')
    this.followerStore = deps.resolve('followerStore')
    this.donationStore = deps.resolve('donationStore')
    this.chatStore = deps.resolve('chatStore')
  }

  public async getEventsSince (streamerId: number, since: number): Promise<ChatMateEvent[]> {
    const diffs = await this.experienceService.getLevelDiffs(streamerId, since)

    let events: ChatMateEvent[] = []
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

    const newDonations = await this.donationStore.getDonationsSince(streamerId, since)
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

    return sortBy(events, e => e.timestamp)
  }
}
