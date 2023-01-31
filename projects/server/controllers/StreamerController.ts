import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank } from '@rebel/server/controllers/preProcessors'
import { PublicStreamerApplication } from '@rebel/server/controllers/public/user/PublicStreamerApplication'
import { streamerApplicationToPublicObject } from '@rebel/server/models/streamer'
import StreamerService from '@rebel/server/services/StreamerService'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerStore, { CloseApplicationArgs, CreateApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { StreamerApplicationAlreadyClosedError, UserAlreadyStreamerError } from '@rebel/server/util/error'
import { GET, Path, PathParam, POST, PreProcessor } from 'typescript-rest'

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

type Deps = ControllerDependencies<{
  streamerStore: StreamerStore
  streamerService: StreamerService
  accountStore: AccountStore
}>

@Path(buildPath('streamer'))
@PreProcessor(requireAuth)
export default class StreamerController extends ControllerBase {
  private readonly streamerStore: StreamerStore
  private readonly streamerService: StreamerService
  private readonly accountStore: AccountStore

  constructor (deps: Deps) {
    super(deps, 'streamer')
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerService = deps.resolve('streamerService')
    this.accountStore = deps.resolve('accountStore')
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
}
