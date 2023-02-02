import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicStreamerApplication } from '@rebel/server/controllers/public/user/PublicStreamerApplication'
import { streamerApplicationToPublicObject } from '@rebel/server/models/streamer'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import StreamerService from '@rebel/server/services/StreamerService'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import StreamerStore, { CloseApplicationArgs, CreateApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { EmptyObject } from '@rebel/server/types'
import { single } from '@rebel/server/util/arrays'
import { ForbiddenError, StreamerApplicationAlreadyClosedError, UserAlreadyStreamerError } from '@rebel/server/util/error'
import { DELETE, GET, Path, PathParam, POST, PreProcessor } from 'typescript-rest'

export type GetStreamersResponse = ApiResponse<{ streamers: string[] }>

export type CreateApplicationRequest = ApiRequest<{ message: string }>
export type CreateApplicationResponse = ApiResponse<{ newApplication: PublicStreamerApplication }>

export type GetApplicationsResponse = ApiResponse<{ streamerApplications: PublicStreamerApplication[] }>

export type ApproveApplicationRequest = ApiRequest<{ message: string }>
export type ApproveApplicationResponse = ApiResponse<{ updatedApplication: PublicStreamerApplication }>

export type RejectApplicationRequest = ApiRequest<{ message: string }>
export type RejectApplicationResponse = ApiResponse<{ updatedApplication: PublicStreamerApplication }>

export type WithdrawApplicationRequest = ApiRequest<{ message: string }>
export type WithdrawApplicationResponse = ApiResponse<{ updatedApplication: PublicStreamerApplication }>

export type GetPrimaryChannelsResponse = ApiResponse<{ youtubeChannelId: number | null, twitchChannelId: number | null }>

export type SetPrimaryChannelResponse = ApiResponse<EmptyObject>

export type UnsetPrimaryChannelResponse = ApiResponse<EmptyObject>

type Deps = ControllerDependencies<{
  streamerStore: StreamerStore
  streamerService: StreamerService
  accountStore: AccountStore
  streamerChannelStore: StreamerChannelStore
  streamerChannelService: StreamerChannelService
}>

@Path(buildPath('streamer'))
@PreProcessor(requireAuth)
export default class StreamerController extends ControllerBase {
  private readonly streamerStore: StreamerStore
  private readonly streamerService: StreamerService
  private readonly accountStore: AccountStore
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly streamerChannelService: StreamerChannelService

  constructor (deps: Deps) {
    super(deps, 'streamer')
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerService = deps.resolve('streamerService')
    this.accountStore = deps.resolve('accountStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.streamerChannelService = deps.resolve('streamerChannelService')
  }

  @GET
  public async getStreamers (): Promise<GetStreamersResponse> {
    const builder = this.registerResponseBuilder<GetStreamersResponse>('GET /')

    try {
      const streamers = await this.streamerStore.getStreamers()
      const users = await this.accountStore.getRegisteredUsersFromIds(streamers.map(s => s.registeredUserId))
      return builder.success({ streamers: users.map(user => user.username) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('application')
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
  @PreProcessor(requireStreamer)
  public async getPrimaryChannels (): Promise<GetPrimaryChannelsResponse> {
    const builder = this.registerResponseBuilder<GetPrimaryChannelsResponse>('POST /primaryChannels')

    try {
      const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([this.getStreamerId()]).then(single)
      return builder.success({
        youtubeChannelId: primaryChannels.youtubeChannel?.platformInfo.channel.id ?? null,
        twitchChannelId: primaryChannels.twitchChannel?.platformInfo.channel.id ?? null
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/primaryChannels/:platform/:channelId')
  @PreProcessor(requireStreamer)
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
      return builder.failure(400, 'Platform must be either `youtube` or `twitch`')
    }

    try {
      await this.streamerChannelService.setPrimaryChannel(this.getStreamerId(), platform as 'youtube' | 'twitch', channelId)
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
  @PreProcessor(requireStreamer)
  public async unsetPrimaryChannel (
    @PathParam('platform') platform: string
  ): Promise<UnsetPrimaryChannelResponse> {
    const builder = this.registerResponseBuilder<UnsetPrimaryChannelResponse>('DELETE /primaryChannels/:platform')

    if (platform == null) {
      return builder.failure(400, 'Platform must be provided.')
    }

    platform = platform.toLowerCase()
    if (platform !== 'youtube' && platform !== 'twitch') {
      return builder.failure(400, 'Platform must be either `youtube` or `twitch`')
    }

    try {
      await this.streamerChannelService.unsetPrimaryChannel(this.getStreamerId(), platform as 'youtube' | 'twitch')
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
