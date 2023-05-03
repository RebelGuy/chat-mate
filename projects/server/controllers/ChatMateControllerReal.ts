import { ControllerBase, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import ExperienceService from '@rebel/server/services/ExperienceService'
import StatusService from '@rebel/server/services/StatusService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { getLiveId, getLivestreamLink } from '@rebel/shared/util/text'
import { filterTypes, nonNull, unique } from '@rebel/shared/util/arrays'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { GetChatMateRegisteredUsernameEndpoint, GetEventsEndpoint, GetMasterchatAuthenticationEndpoint, GetStatusEndpoint, IChatMateController, SetActiveLivestreamEndpoint } from '@rebel/server/controllers/ChatMateController'
import ChannelService, {  } from '@rebel/server/services/ChannelService'
import { userDataToPublicUser } from '@rebel/server/models/user'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import LivestreamService from '@rebel/server/services/LivestreamService'
import { promised } from '@rebel/server/_test/utils'
import MasterchatService from '@rebel/server/services/MasterchatService'
import RankStore from '@rebel/server/stores/RankStore'
import DonationStore from '@rebel/server/stores/DonationStore'
import { livestreamToPublic } from '@rebel/server/models/livestream'
import ChatMateEventService from '@rebel/server/services/ChatMateEventService'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { PublicLevelUpData } from '@rebel/server/controllers/public/event/PublicLevelUpData'
import { PublicNewTwitchFollowerData } from '@rebel/server/controllers/public/event/PublicNewTwitchFollowerData'
import { PublicDonationData } from '@rebel/server/controllers/public/event/PublicDonationData'
import { toPublicMessagePart } from '@rebel/server/models/chat'
import AccountStore from '@rebel/server/stores/AccountStore'
import AccountService from '@rebel/server/services/AccountService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'

export type ChatMateControllerDeps = ControllerDependencies<{
  livestreamStore: LivestreamStore
  masterchatStatusService: StatusService
  twurpleStatusService: StatusService
  experienceService: ExperienceService
  channelService: ChannelService
  followerStore: FollowerStore
  punishmentService: PunishmentService
  livestreamService: LivestreamService
  masterchatService: MasterchatService
  rankStore: RankStore
  donationStore: DonationStore
  chatMateEventService: ChatMateEventService
  accountStore: AccountStore
  accountService: AccountService
  chatMateRegisteredUserName: string
  streamerStore: StreamerStore
  streamerChannelStore: StreamerChannelStore
}>

export default class ChatMateControllerReal extends ControllerBase implements IChatMateController {
  readonly livestreamStore: LivestreamStore
  readonly masterchatStatusService: StatusService
  readonly twurpleStatusService: StatusService
  readonly experienceService: ExperienceService
  readonly channelService: ChannelService
  readonly followerStore: FollowerStore
  readonly punishmentService: PunishmentService
  readonly livestreamService: LivestreamService
  readonly masterchatService: MasterchatService
  readonly rankStore: RankStore
  readonly donationStore: DonationStore
  readonly chatMateEventService: ChatMateEventService
  readonly accountStore: AccountStore
  readonly accountService: AccountService
  readonly chatMateRegisteredUserName: string
  readonly streamerStore: StreamerStore
  readonly streamerChannelStore: StreamerChannelStore

  constructor (deps: ChatMateControllerDeps) {
    super(deps, '/chatMate')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchatStatusService = deps.resolve('masterchatStatusService')
    this.twurpleStatusService = deps.resolve('twurpleStatusService')
    this.experienceService = deps.resolve('experienceService')
    this.channelService = deps.resolve('channelService')
    this.followerStore = deps.resolve('followerStore')
    this.punishmentService = deps.resolve('punishmentService')
    this.livestreamService = deps.resolve('livestreamService')
    this.masterchatService = deps.resolve('masterchatService')
    this.rankStore = deps.resolve('rankStore')
    this.donationStore = deps.resolve('donationStore')
    this.chatMateEventService = deps.resolve('chatMateEventService')
    this.accountStore = deps.resolve('accountStore')
    this.accountService = deps.resolve('accountService')
    this.chatMateRegisteredUserName = deps.resolve('chatMateRegisteredUserName')
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
  }

  public async getStatus (args: In<GetStatusEndpoint>): Out<GetStatusEndpoint> {
    const { builder } = args
    const livestreamStatus = await this.getLivestreamStatus(this.getStreamerId())
    const youtubeApiStatus = this.masterchatStatusService.getApiStatus()
    const twitchApiStatus = this.twurpleStatusService.getApiStatus()

    return builder.success({ livestreamStatus, youtubeApiStatus, twitchApiStatus })
  }

  public async getEvents (args: In<GetEventsEndpoint>): Out<GetEventsEndpoint> {
    const { builder, since } = args
    const streamerId = this.getStreamerId()

    const events = await this.chatMateEventService.getEventsSince(streamerId, since)

    // pre-fetch user data for `levelUp` and `donation` events
    const primaryUserIds = unique(nonNull(filterTypes(events, 'levelUp', 'donation').map(e => e.primaryUserId)))
    const allData = await this.apiService.getAllData(primaryUserIds)

    let result: PublicChatMateEvent[] = []
    for (const event of events) {
      let levelUpData: PublicLevelUpData | null = null
      let newTwitchFollowerData: PublicNewTwitchFollowerData | null = null
      let donationData: PublicDonationData | null = null

      if (event.type === 'levelUp') {
        const user: PublicUser = userDataToPublicUser(allData.find(d => d.primaryUserId === event.primaryUserId)!)
        levelUpData = {
          newLevel: event.newLevel,
          oldLevel: event.oldLevel,
          user: user
        }
      } else if (event.type === 'newTwitchFollower') {
        newTwitchFollowerData = {
          displayName: event.displayName
        }
      } else if (event.type === 'donation') {
        const user: PublicUser | null = event.primaryUserId == null ? null : userDataToPublicUser(allData.find(d => d.primaryUserId === event.primaryUserId)!)
        donationData = {
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

    const streamerId = this.getStreamerId()
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
      authenticated: this.masterchatService.checkCredentials()
    }))
  }

  public getChatMateRegisteredUsername (args: In<GetChatMateRegisteredUsernameEndpoint>): Out<GetChatMateRegisteredUsernameEndpoint> {
    return promised(args.builder.success({ username: this.chatMateRegisteredUserName }))
  }

  private async getLivestreamStatus (streamerId: number): Promise<PublicLivestreamStatus | null> {
    const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (activeLivestream == null) {
      return null
    }

    const publicLivestream = livestreamToPublic(activeLivestream)
    let viewers: { time: Date, viewCount: number, twitchViewCount: number } | null = null
    if (publicLivestream.status === 'live') {
      viewers = await this.livestreamStore.getLatestLiveCount(publicLivestream.id)
    }

    return {
      livestream: publicLivestream,
      youtubeLiveViewers: viewers?.viewCount ?? null,
      twitchLiveViewers: viewers?.twitchViewCount ?? null,
    }
  }
}
