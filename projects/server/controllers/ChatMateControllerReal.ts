import { LiveStatus } from '@rebel/masterchat'
import { ControllerBase, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import ExperienceService from '@rebel/server/services/ExperienceService'
import StatusService from '@rebel/server/services/StatusService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { getLiveId, getLivestreamLink } from '@rebel/server/util/text'
import { filterTypes, nonNull, unique, zipOnStrictMany } from '@rebel/server/util/arrays'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { GetEventsEndpoint, GetMasterchatAuthenticationEndpoint, GetStatusEndpoint, IChatMateController, SetActiveLivestreamEndpoint } from '@rebel/server/controllers/ChatMateController'
import ChannelService from '@rebel/server/services/ChannelService'
import { userDataToPublicUser } from '@rebel/server/models/user'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import LivestreamService from '@rebel/server/services/LivestreamService'
import { promised } from '@rebel/server/_test/utils'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import RankStore from '@rebel/server/stores/RankStore'
import DonationStore from '@rebel/server/stores/DonationStore'
import { livestreamToPublic } from '@rebel/server/models/livestream'
import ChatMateEventService from '@rebel/server/services/ChatMateEventService'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { PublicLevelUpData } from '@rebel/server/controllers/public/event/PublicLevelUpData'
import { PublicNewTwitchFollowerData } from '@rebel/server/controllers/public/event/PublicNewTwitchFollowerData'
import { PublicDonationData } from '@rebel/server/controllers/public/event/PublicDonationData'
import { toPublicMessagePart } from '@rebel/server/models/chat'

export type ChatMateControllerDeps = ControllerDependencies<{
  livestreamStore: LivestreamStore
  viewershipStore: ViewershipStore
  masterchatStatusService: StatusService
  twurpleStatusService: StatusService
  experienceService: ExperienceService
  channelService: ChannelService
  followerStore: FollowerStore
  punishmentService: PunishmentService
  livestreamService: LivestreamService
  masterchatProxyService: MasterchatProxyService
  rankStore: RankStore
  donationStore: DonationStore
  chatMateEventService: ChatMateEventService
}>

export default class ChatMateControllerReal extends ControllerBase implements IChatMateController {
  readonly livestreamStore: LivestreamStore
  readonly viewershipStore: ViewershipStore
  readonly masterchatStatusService: StatusService
  readonly twurpleStatusService: StatusService
  readonly experienceService: ExperienceService
  readonly channelService: ChannelService
  readonly followerStore: FollowerStore
  readonly punishmentService: PunishmentService
  readonly livestreamService: LivestreamService
  readonly masterchatProxyService: MasterchatProxyService
  readonly rankStore: RankStore
  readonly donationStore: DonationStore
  readonly chatMateEventService: ChatMateEventService

  constructor (deps: ChatMateControllerDeps) {
    super(deps, '/chatMate')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.masterchatStatusService = deps.resolve('masterchatStatusService')
    this.twurpleStatusService = deps.resolve('twurpleStatusService')
    this.experienceService = deps.resolve('experienceService')
    this.channelService = deps.resolve('channelService')
    this.followerStore = deps.resolve('followerStore')
    this.punishmentService = deps.resolve('punishmentService')
    this.livestreamService = deps.resolve('livestreamService')
    this.masterchatProxyService = deps.resolve('masterchatProxyService')
    this.rankStore = deps.resolve('rankStore')
    this.donationStore = deps.resolve('donationStore')
    this.chatMateEventService = deps.resolve('chatMateEventService')
  }

  public async getStatus (args: In<GetStatusEndpoint>): Out<GetStatusEndpoint> {
    const { builder } = args
    const livestreamStatus = await this.getLivestreamStatus(this.getStreamerId()!)
    const youtubeApiStatus = this.masterchatStatusService.getApiStatus()
    const twitchApiStatus = this.twurpleStatusService.getApiStatus()

    return builder.success({ livestreamStatus, youtubeApiStatus, twitchApiStatus })
  }

  public async getEvents (args: In<GetEventsEndpoint>): Out<GetEventsEndpoint> {
    const { builder, since } = args

    const events = await this.chatMateEventService.getEventsSince(this.getStreamerId()!, since)

    // pre-fetch user data for `levelUp` events
    const userIds = unique(nonNull(filterTypes(events, 'levelUp', 'donation').map(e => e.userId)))
    const userChannels = await this.channelService.getActiveUserChannels(userIds)
    const levelInfo = await this.experienceService.getLevels(this.getStreamerId()!, userIds)
    const ranks = await this.rankStore.getUserRanks(userIds, this.getStreamerId())
    const userData = zipOnStrictMany(userChannels, 'userId', levelInfo, ranks)

    let result: PublicChatMateEvent[] = []
    for (const event of events) {
      let levelUpData: PublicLevelUpData | null = null
      let newTwitchFollowerData: PublicNewTwitchFollowerData | null = null
      let donationData: PublicDonationData | null = null

      if (event.type === 'levelUp') {
        const user: PublicUser = userDataToPublicUser(userData.find(d => d.userId === event.userId)!)
        levelUpData = {
          schema: 3,
          newLevel: event.newLevel,
          oldLevel: event.oldLevel,
          user
        }
      } else if (event.type === 'newTwitchFollower') {
        newTwitchFollowerData = {
          schema: 1,
          displayName: event.displayName
        }
      } else if (event.type === 'donation') {
        const user: PublicUser | null = event.userId == null ? null : userDataToPublicUser(userData.find(d => d.userId === event.userId)!)
        donationData = {
          schema: 1,
          id: event.donation.id,
          time: event.donation.time.getTime(),
          amount: event.donation.amount,
          formattedAmount: event.donation.formattedAmount,
          currency: event.donation.currency,
          name: event.donation.name,
          messageParts: event.donation.messageParts.map(toPublicMessagePart),
          linkedUser: user
        }
      } else {
        assertUnreachable(event)
      }

      result.push({
        schema: 5,
        type: event.type,
        timestamp: event.timestamp,
        levelUpData,
        newTwitchFollowerData,
        donationData
      })
    }

    return builder.success({
      reusableTimestamp: result.at(-1)?.timestamp ?? since,
      events: result
    })
  }

  public async setActiveLivestream (args: In<SetActiveLivestreamEndpoint>): Out<SetActiveLivestreamEndpoint> {
    let liveId: string | null
    if (args.livestream == null) {
      liveId = null
    } else {
      try {
        liveId = getLiveId(args.livestream)
      } catch (e: any) {
        return args.builder.failure(400, `Cannot parse the liveId: ${e.message}`)
      }
    }

    const streamerId = this.getStreamerId()!
    const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (activeLivestream == null && liveId != null) {
      await this.livestreamService.setActiveLivestream(streamerId, liveId)
    } else if (activeLivestream != null && liveId == null) {
      await this.livestreamService.deactivateLivestream(streamerId)
    } else if (!(activeLivestream == null && liveId == null || activeLivestream!.liveId === liveId)) {
      return args.builder.failure(422, `Cannot set active livestream ${liveId} for streamer ${streamerId} because another livestream is already active.`)
    }

    return args.builder.success({ livestreamLink: liveId == null ? null : getLivestreamLink(liveId) })
  }

  public getMasterchatAuthentication (args: In<GetMasterchatAuthenticationEndpoint>): Out<GetMasterchatAuthenticationEndpoint> {
    return promised(args.builder.success({
      authenticated: this.masterchatProxyService.checkCredentials()
    }))
  }

  private async getLivestreamStatus (streamerId: number): Promise<PublicLivestreamStatus | null> {
    const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (activeLivestream == null) {
      return null
    }

    const publicLivestream = livestreamToPublic(activeLivestream)
    let viewers: { time: Date, viewCount: number, twitchViewCount: number } | null = null
    if (publicLivestream.status === 'live') {
      viewers = await this.viewershipStore.getLatestLiveCount(streamerId)
    }

    return {
      schema: 3,
      livestream: publicLivestream,
      youtubeLiveViewers: viewers?.viewCount ?? null,
      twitchLiveViewers: viewers?.twitchViewCount ?? null,
    }
  }
}
