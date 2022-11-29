import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ExperienceService from '@rebel/server/services/ExperienceService'
import DonationStore, { DonationWithMessage } from '@rebel/server/stores/DonationStore'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { sortBy } from '@rebel/server/util/arrays'

export type ChatMateEvent = { timestamp: number } & ({
  type: 'levelUp'
  oldLevel: number
  newLevel: number
  userId: number
} | {
  type: 'newTwitchFollower'
  displayName: string
} | {
  type: 'donation'
  donation: DonationWithMessage
  userId: number | null
})

type Deps = Dependencies<{
  experienceService: ExperienceService
  followerStore: FollowerStore
  donationStore: DonationStore
}>

export default class ChatMateEventService extends ContextClass {
  private readonly experienceService: ExperienceService
  private readonly followerStore: FollowerStore
  private readonly donationStore: DonationStore

  constructor (deps: Deps) {
    super()
    this.experienceService = deps.resolve('experienceService')
    this.followerStore = deps.resolve('followerStore')
    this.donationStore = deps.resolve('donationStore')
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
        userId: diff.userId
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
        userId: donation.userId
      })
    }

    return sortBy(events, e => e.timestamp)
  }
}
