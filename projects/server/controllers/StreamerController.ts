import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicChatMateEvent } from '@rebel/api-models/public/event/PublicChatMateEvent'
import { PublicDonationData } from '@rebel/api-models/public/event/PublicDonationData'
import { PublicLevelUpData } from '@rebel/api-models/public/event/PublicLevelUpData'
import { PublicNewTwitchFollowerData } from '@rebel/api-models/public/event/PublicNewTwitchFollowerData'
import { PublicNewViewerData } from '@rebel/api-models/public/event/PublicNewViewerData'
import { PublicChatMessageDeletedData } from '@rebel/api-models/public/event/PublicChatMessageDeletedData'
import { PublicLivestreamStatus } from '@rebel/api-models/public/status/PublicLivestreamStatus'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'
import { PublicTwitchEventStatus } from '@rebel/api-models/public/streamer/PublicTwitchEventStatus'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { toPublicMessagePart } from '@rebel/server/models/chat'
import { livestreamToPublic } from '@rebel/server/models/livestream'
import { streamerApplicationToPublicObject } from '@rebel/server/models/streamer'
import { channelToPublicChannel, userDataToPublicUser } from '@rebel/server/models/user'
import { getUserName } from '@rebel/server/services/ChannelService'
import ChatMateEventService from '@rebel/server/services/ChatMateEventService'
import LivestreamService from '@rebel/server/services/LivestreamService'
import MasterchatService from '@rebel/server/services/MasterchatService'
import StatusService from '@rebel/server/services/StatusService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import StreamerService from '@rebel/server/services/StreamerService'
import StreamerTwitchEventService from '@rebel/server/services/StreamerTwitchEventService'
import AccountStore from '@rebel/server/stores/AccountStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import StreamerStore, { CloseApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { filterTypes, nonNull, single, unique, zipOnStrict } from '@rebel/shared/util/arrays'
import { ForbiddenError, StreamerApplicationAlreadyClosedError, UserAlreadyStreamerError } from '@rebel/shared/util/error'
import { keysOf } from '@rebel/shared/util/objects'
import { getLiveId, getLivestreamLink } from '@rebel/shared/util/text'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { DELETE, GET, PATCH, Path, PathParam, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { ApproveApplicationRequest, ApproveApplicationResponse, CreateApplicationRequest, CreateApplicationResponse, GetApplicationsResponse, GetEventsResponse, GetPrimaryChannelsResponse, GetStatusResponse, GetStreamersResponse, GetTwitchLoginUrlResponse, GetTwitchStatusResponse, GetYoutubeLoginUrlResponse, GetYoutubeStatusResponse, RejectApplicationRequest, RejectApplicationResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse, SetPrimaryChannelResponse, TwitchAuthorisationResponse, UnsetPrimaryChannelResponse, WithdrawApplicationRequest, WithdrawApplicationResponse, YoutubeAuthorisationResponse } from '@rebel/api-models/schema/streamer'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'

type Deps = ControllerDependencies<{
  streamerStore: StreamerStore
  streamerService: StreamerService
  accountStore: AccountStore
  streamerChannelStore: StreamerChannelStore
  streamerChannelService: StreamerChannelService
  streamerTwitchEventService: StreamerTwitchEventService
  masterchatService: MasterchatService
  livestreamStore: LivestreamStore
  masterchatStatusService: StatusService
  twurpleStatusService: StatusService
  chatMateEventService: ChatMateEventService
  livestreamService: LivestreamService
  youtubeAuthProvider: YoutubeAuthProvider
}>

@Path(buildPath('streamer'))
export default class StreamerController extends ControllerBase {
  private readonly streamerStore: StreamerStore
  private readonly streamerService: StreamerService
  private readonly accountStore: AccountStore
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly streamerChannelService: StreamerChannelService
  private readonly streamerTwitchEventService: StreamerTwitchEventService
  private readonly masterchatService: MasterchatService
  private readonly livestreamStore: LivestreamStore
  private readonly masterchatStatusService: StatusService
  private readonly twurpleStatusService: StatusService
  private readonly chatMateEventService: ChatMateEventService
  private readonly livestreamService: LivestreamService
  private readonly youtubeAuthProvider: YoutubeAuthProvider

  constructor (deps: Deps) {
    super(deps, 'streamer')
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerService = deps.resolve('streamerService')
    this.accountStore = deps.resolve('accountStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.streamerChannelService = deps.resolve('streamerChannelService')
    this.streamerTwitchEventService = deps.resolve('streamerTwitchEventService')
    this.masterchatService = deps.resolve('masterchatService')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchatStatusService = deps.resolve('masterchatStatusService')
    this.twurpleStatusService = deps.resolve('twurpleStatusService')
    this.chatMateEventService = deps.resolve('chatMateEventService')
    this.livestreamService = deps.resolve('livestreamService')
    this.youtubeAuthProvider = deps.resolve('youtubeAuthProvider')
  }

  @GET
  public async getStreamers (): Promise<GetStreamersResponse> {
    const builder = this.registerResponseBuilder<GetStreamersResponse>('GET /')

    try {
      const livestreamPromise = this.livestreamStore.getActiveLivestreams()
      const streamers = await this.streamerStore.getStreamers()
      const primaryChannelsPromise = this.streamerChannelStore.getPrimaryChannels(streamers.map(streamer => streamer.id))
      const users = await this.accountStore.getRegisteredUsersFromIds(streamers.map(s => s.registeredUserId))
      const livestreams = await livestreamPromise
      const primaryChannels = await primaryChannelsPromise

      const streamerUsers = zipOnStrict(streamers, users, 'registeredUserId', 'id', 'registeredUserId')
      const streamerSummary: PublicStreamerSummary[] = streamerUsers.map(streamer => {
        const livestream = livestreams.find(stream => stream.streamerId === streamer.id)
        const { youtubeChannel, twitchChannel } = primaryChannels.find(channels => channels.streamerId === streamer.id)!
        return {
          username: streamer.username,
          currentLivestream: livestream == null ? null : livestreamToPublic(livestream),
          youtubeChannel: youtubeChannel == null ? null : channelToPublicChannel(youtubeChannel),
          twitchChannel: twitchChannel == null ? null : channelToPublicChannel(twitchChannel)
        }
      })

      return builder.success({ streamers: streamerSummary })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('application')
  @PreProcessor(requireAuth)
  public async getApplications (): Promise<GetApplicationsResponse> {
    const builder = this.registerResponseBuilder<GetApplicationsResponse>('GET /application')

    try {
      const isAdmin = this.hasRankOrAbove('admin')
      const registeredUserId = isAdmin ? undefined : this.getCurrentUser().id
      const applications = await this.streamerStore.getStreamerApplications(registeredUserId)
      return builder.success({ streamerApplications: applications.map(streamerApplicationToPublicObject) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('application')
  @PreProcessor(requireAuth)
  public async createApplication (request: CreateApplicationRequest): Promise<CreateApplicationResponse> {
    const builder = this.registerResponseBuilder<CreateApplicationResponse>('POST /application')

    try {
      const registeredUserId = super.getCurrentUser().id
      const application = await this.streamerService.createStreamerApplication(registeredUserId, request.message)
      return builder.success({ newApplication: streamerApplicationToPublicObject(application) })

    } catch (e: any) {
      if (e instanceof UserAlreadyStreamerError) {
        return builder.failure(400, e)
      }
      return builder.failure(e)
    }
  }

  @POST
  @Path('application/:streamerApplicationId/approve')
  @PreProcessor(requireRank('admin'))
  public async approveApplication (
    @PathParam('streamerApplicationId') streamerApplicationId: number,
    request: ApproveApplicationRequest
  ): Promise<ApproveApplicationResponse> {
    const builder = this.registerResponseBuilder<ApproveApplicationResponse>('POST /application/:streamerApplicationId/approve')

    try {
      const application = await this.streamerService.approveStreamerApplication(streamerApplicationId, request.message, this.getCurrentUser().id)
      return builder.success({ updatedApplication: streamerApplicationToPublicObject(application) })

    } catch (e: any) {
      if (e instanceof StreamerApplicationAlreadyClosedError || e instanceof UserAlreadyStreamerError) {
        return builder.failure(400, e)
      }
      return builder.failure(e)
    }
  }

  @POST
  @Path('application/:streamerApplicationId/reject')
  @PreProcessor(requireRank('admin'))
  public async rejectApplication (
    @PathParam('streamerApplicationId') streamerApplicationId: number,
    request: RejectApplicationRequest
  ): Promise<RejectApplicationResponse> {
    const builder = this.registerResponseBuilder<RejectApplicationResponse>('POST /application/:streamerApplicationId/reject')

    try {
      const data: CloseApplicationArgs = {
        id: streamerApplicationId,
        approved: false,
        message: request.message
      }
      const application = await this.streamerStore.closeStreamerApplication(data)
      return builder.success({ updatedApplication: streamerApplicationToPublicObject(application) })

    } catch (e: any) {
      if (e instanceof StreamerApplicationAlreadyClosedError) {
        return builder.failure(400, e)
      }
      return builder.failure(e)
    }
  }

  @POST
  @Path('application/:streamerApplicationId/withdraw')
  @PreProcessor(requireAuth)
  public async withdrawApplication (
    @PathParam('streamerApplicationId') streamerApplicationId: number,
    request: WithdrawApplicationRequest
  ): Promise<WithdrawApplicationResponse> {
    const builder = this.registerResponseBuilder<RejectApplicationResponse>('POST /application/:streamerApplicationId/withdraw')

    const applications = await this.streamerStore.getStreamerApplications(this.getCurrentUser().id)
    if (!applications.map(app => app.id).includes(streamerApplicationId)) {
      return builder.failure(404, 'Not Found')
    }

    try {
      const data: CloseApplicationArgs = {
        id: streamerApplicationId,
        approved: null,
        message: request.message
      }
      const application = await this.streamerStore.closeStreamerApplication(data)
      return builder.success({ updatedApplication: streamerApplicationToPublicObject(application) })

    } catch (e: any) {
      if (e instanceof StreamerApplicationAlreadyClosedError) {
        return builder.failure(400, e)
      }
      return builder.failure(e)
    }
  }

  @GET
  @Path('/primaryChannels')
  @PreProcessor(requireAuth)
  public async getPrimaryChannels (): Promise<GetPrimaryChannelsResponse> {
    const builder = this.registerResponseBuilder<GetPrimaryChannelsResponse>('POST /primaryChannels')

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([streamer.id]).then(single)
      return builder.success({
        youtubeChannelId: primaryChannels.youtubeChannel?.platformInfo.channel.id ?? null,
        twitchChannelId: primaryChannels.twitchChannel?.platformInfo.channel.id ?? null,
        twitchChannelName: primaryChannels.twitchChannel != null ? getUserName(primaryChannels.twitchChannel) : null
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/primaryChannels/:platform/:channelId')
  @PreProcessor(requireAuth)
  public async setPrimaryChannel (
    @PathParam('platform') platform: string,
    @PathParam('channelId') channelId: number
  ): Promise<SetPrimaryChannelResponse> {
    const builder = this.registerResponseBuilder<SetPrimaryChannelResponse>('POST /primaryChannels/:platform/:channelId')

    if (platform == null || channelId == null) {
      return builder.failure(400, 'Platform and ChannelId must be provided.')
    }

    platform = platform.toLowerCase()
    if (platform !== 'youtube' && platform !== 'twitch') {
      return builder.failure(400, 'Platform must be either `youtube` or `twitch`.')
    }

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      await this.streamerChannelService.setPrimaryChannel(streamer.id, platform as 'youtube' | 'twitch', channelId)
      return builder.success({})
    } catch (e: any) {
      if (e instanceof ForbiddenError) {
        return builder.failure(403, e.message)
      } else {
        return builder.failure(e)
      }
    }
  }

  @DELETE
  @Path('/primaryChannels/:platform')
  @PreProcessor(requireAuth)
  public async unsetPrimaryChannel (
    @PathParam('platform') platform: string
  ): Promise<UnsetPrimaryChannelResponse> {
    const builder = this.registerResponseBuilder<UnsetPrimaryChannelResponse>('DELETE /primaryChannels/:platform')

    if (platform == null) {
      return builder.failure(400, 'Platform must be provided.')
    }

    platform = platform.toLowerCase()
    if (platform !== 'youtube' && platform !== 'twitch') {
      return builder.failure(400, 'Platform must be either `youtube` or `twitch`.')
    }

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      await this.streamerChannelService.unsetPrimaryChannel(streamer.id, platform as 'youtube' | 'twitch')
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/twitch/status')
  @PreProcessor(requireAuth)
  public async getTwitchStatus (): Promise<GetTwitchStatusResponse> {
    const builder = this.registerResponseBuilder<GetTwitchStatusResponse>('GET /twitch/status')

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      const statuses = await this.streamerTwitchEventService.getStatuses(streamer.id)
      if (statuses == null) {
        return builder.failure(404, 'No Twitch statuses found. Please ensure you have set a primary Twitch channel.')
      }

      let result: PublicTwitchEventStatus[] = []
      for (const type of keysOf(statuses)) {
        const status = statuses[type]
        result.push({
          eventType: type,
          status: status.status,
          errorMessage: status.message ?? null,
          lastChange: status.lastChange,
          requiresAuthorisation: status.requiresAuthorisation ?? false
        })
      }
      return builder.success({ statuses: result })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/twitch/login')
  @PreProcessor(requireAuth)
  public async getTwitchLoginUrl (): Promise<GetTwitchLoginUrlResponse> {
    const builder = this.registerResponseBuilder<GetTwitchLoginUrlResponse>('GET /twitch/login')

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      const url = this.streamerService.getTwitchLoginUrl()
      return builder.success({ url })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/twitch/authorise')
  @PreProcessor(requireAuth)
  public async authoriseTwitch (
    @QueryParam('code') code: string
  ): Promise<TwitchAuthorisationResponse> {
    const builder = this.registerResponseBuilder<TwitchAuthorisationResponse>('POST /twitch/authorise')

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      await this.streamerService.authoriseTwitchLogin(streamer.id, code)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/youtube/status')
  @PreProcessor(requireAuth)
  public async getYoutubeStatus (): Promise<GetYoutubeStatusResponse> {
    const builder = this.registerResponseBuilder<GetYoutubeStatusResponse>('GET /youtube/status')

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      const status = await this.masterchatService.getChatMateModeratorStatus(streamer.id)
      return builder.success({ chatMateIsModerator: status.isModerator, timestamp: status.time })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/youtube/login')
  @PreProcessor(requireAuth)
  public async getYoutubeLoginUrl (): Promise<GetYoutubeLoginUrlResponse> {
    const builder = this.registerResponseBuilder<GetYoutubeLoginUrlResponse>('GET /youtube/login')

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      const externalChannelId = await this.streamerChannelService.getYoutubeExternalId(streamer.id)
      if (externalChannelId == null) {
        return builder.failure(400, 'User does not have a primary Youtube channel.')
      }

      const url = this.youtubeAuthProvider.getAuthUrlForStreamer(externalChannelId)

      return builder.success({ url })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/youtube/authorise')
  @PreProcessor(requireAuth)
  public async authoriseYoutube (
    @QueryParam('code') code: string,
    @QueryParam('state') state: string
  ): Promise<YoutubeAuthorisationResponse> {
    const builder = this.registerResponseBuilder<YoutubeAuthorisationResponse>('POST /youtube/authorise')

    try {
      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(this.getCurrentUser().id)
      if (streamer == null) {
        return builder.failure(403, 'User is not a streamer.')
      }

      const externalChannelId = await this.streamerChannelService.getYoutubeExternalId(streamer.id)
      if (externalChannelId == null) {
        return builder.failure(400, 'User does not have a primary Youtube channel.')
      }

      await this.youtubeAuthProvider.authoriseStreamer(externalChannelId, code, state)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('status')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireAuth)
  public async getStatus (): Promise<GetStatusResponse> {
    const builder = this.registerResponseBuilder<GetStatusResponse>('GET /status')
    try {
      const livestreamStatus = await this.getLivestreamStatus(this.getStreamerId())
      const youtubeApiStatus = this.masterchatStatusService.getApiStatus()
      const twitchApiStatus = this.twurpleStatusService.getApiStatus()

      return builder.success({ livestreamStatus, youtubeApiStatus, twitchApiStatus })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('events')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async getEvents (
    @QueryParam('since') since: number
  ): Promise<GetEventsResponse> {
    const builder = this.registerResponseBuilder<GetEventsResponse>('GET /events')
    if (since == null) {
      return builder.failure(400, `A value for 'since' must be provided.`)
    }

    try {
      const streamerId = this.getStreamerId()

      const events = await this.chatMateEventService.getEventsSince(streamerId, since)

      // pre-fetch user data for some of the events
      const primaryUserIds = unique(nonNull(filterTypes(events, 'levelUp', 'donation', 'newViewer').map(e => e.primaryUserId)))
      const allData = await this.apiService.getAllData(primaryUserIds)

      let result: PublicChatMateEvent[] = []
      for (const event of events) {
        let levelUpData: PublicLevelUpData | null = null
        let newTwitchFollowerData: PublicNewTwitchFollowerData | null = null
        let donationData: PublicDonationData | null = null
        let newViewerData: PublicNewViewerData | null = null
        let chatMessageDeletedData: PublicChatMessageDeletedData | null = null

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
        } else if (event.type === 'newViewer') {
          const user: PublicUser = userDataToPublicUser(allData.find(d => d.primaryUserId === event.primaryUserId)!)
          newViewerData = {
            user: user
          }
        } else if (event.type === 'chatMessageDeleted') {
          chatMessageDeletedData = {
            chatMessageId: event.chatMessageId
          }
        } else {
          assertUnreachable(event)
        }

        result.push({
          type: event.type,
          timestamp: event.timestamp,
          levelUpData,
          newTwitchFollowerData,
          donationData,
          newViewerData,
          chatMessageDeletedData
        })
      }

      return builder.success({
        reusableTimestamp: result.at(-1)?.timestamp ?? since,
        events: result
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @PATCH
  @Path('livestream')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async setActiveLivestream (request: SetActiveLivestreamRequest): Promise<SetActiveLivestreamResponse> {
    const builder = this.registerResponseBuilder<SetActiveLivestreamResponse>('PATCH /livestream')
    if (request == null || request.livestream === undefined) {
      return builder.failure(400, `A value for 'livestream' must be provided or set to null.`)
    }

    try {
      let liveId: string | null
      if (request.livestream == null) {
        liveId = null
      } else {
        try {
          liveId = getLiveId(request.livestream)
        } catch (e: any) {
          return builder.failure(400, `Cannot parse the liveId: ${e.message}`)
        }
      }

      const streamerId = this.getStreamerId()
      const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
      if (activeLivestream == null && liveId != null) {
        await this.livestreamService.setActiveLivestream(streamerId, liveId)
      } else if (activeLivestream != null && liveId == null) {
        await this.livestreamService.deactivateLivestream(streamerId)
      } else if (!(activeLivestream == null && liveId == null || activeLivestream!.liveId === liveId)) {
        return builder.failure(422, `Cannot set active livestream ${liveId} for streamer ${streamerId} because another livestream is already active.`)
      }

      return builder.success({ livestreamLink: liveId == null ? null : getLivestreamLink(liveId) })
    } catch (e: any) {
      return builder.failure(e)
    }
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
