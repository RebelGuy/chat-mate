import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth } from '@rebel/server/controllers/preProcessors'
import { PublicStreamerApplication } from '@rebel/server/controllers/public/user/PublicStreamerApplication'
import { streamerApplicationToPublicObject } from '@rebel/server/models/streamer'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerStore, { CloseApplicationArgs, CreateApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { StreamerApplicationAlreadyClosedError } from '@rebel/server/util/error'
import { GET, Path, PathParam, POST, PreProcessor } from 'typescript-rest'

type Deps = ControllerDependencies<{
  accountStore: AccountStore
  streamerStore: StreamerStore
}>

export type CreateApplicationRequest = ApiRequest<1, { schema: 1, message: string }>
export type CreateApplicationResponse = ApiResponse<1, { newApplication: PublicStreamerApplication }>

export type GetApplicationsResponse = ApiResponse<1, { streamerApplications: PublicStreamerApplication[] }>

export type ApproveApplicationRequest = ApiRequest<1, { schema: 1, message: string }>
export type ApproveApplicationResponse = ApiResponse<1, { updatedApplication: PublicStreamerApplication }>

export type RejectApplicationRequest = ApiRequest<1, { schema: 1, message: string }>
export type RejectApplicationResponse = ApiResponse<1, { updatedApplication: PublicStreamerApplication }>

export type WithdrawApplicationRequest = ApiRequest<1, { schema: 1, message: string }>
export type WithdrawApplicationResponse = ApiResponse<1, { updatedApplication: PublicStreamerApplication }>

@Path(buildPath('streamer'))
@PreProcessor(requireAuth)
export default class StreamerController extends ControllerBase {
  private readonly accountStore: AccountStore
  private readonly streamerStore: StreamerStore

  constructor (deps: Deps) {
    super(deps, 'streamer')
    this.accountStore = deps.resolve('accountStore')
    this.streamerStore = deps.resolve('streamerStore')
  }

  @GET
  @Path('application')
  public async getApplications (): Promise<GetApplicationsResponse> {
    const builder = this.registerResponseBuilder<GetApplicationsResponse>('GET /application', 1)

    // todo: if the user is not an admin, the user can only get their own applications

    try {
      const applications = await this.streamerStore.getStreamerApplications()
      return builder.success({ streamerApplications: applications.map(streamerApplicationToPublicObject) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('application')
  public async createApplication (request: CreateApplicationRequest): Promise<CreateApplicationResponse> {
    const builder = this.registerResponseBuilder<CreateApplicationResponse>('POST /application', 1)

    try {
      const data: CreateApplicationArgs = {
        registeredUserId: super.getCurrentUser()!.id,
        message: request.message
      }
      const application = await this.streamerStore.addStreamerApplication(data)
      return builder.success({ newApplication: streamerApplicationToPublicObject(application) })

    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('application/:streamerApplicationId/approve')
  public async approveApplication (
    @PathParam('streamerApplicationId') streamerApplicationId: number,
    request: ApproveApplicationRequest
  ): Promise<ApproveApplicationResponse> {
    const builder = this.registerResponseBuilder<ApproveApplicationResponse>('POST /application/:streamerApplicationId/approve', 1)

    try {
      const data: CloseApplicationArgs = {
        id: streamerApplicationId,
        approved: true,
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
  @Path('application/:streamerApplicationId/reject')
  public async rejectApplication (
    @PathParam('streamerApplicationId') streamerApplicationId: number,
    request: RejectApplicationRequest
  ): Promise<RejectApplicationResponse> {
    const builder = this.registerResponseBuilder<RejectApplicationResponse>('POST /application/:streamerApplicationId/reject', 1)

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
    const builder = this.registerResponseBuilder<RejectApplicationResponse>('POST /application/:streamerApplicationId/withdraw', 1)

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
