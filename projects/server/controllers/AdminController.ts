import { ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireRank } from '@rebel/server/controllers/preProcessors'
import AdminService from '@rebel/server/services/rank/AdminService'
import { EmptyObject } from '@rebel/shared/types'
import { GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'

export type GetAdministrativeModeResponse = ApiResponse<{ isAdministrativeMode: boolean }>

export type GetTwitchLoginUrlResponse = ApiResponse<{ url: string }>

export type TwitchAuthorisationResponse = ApiResponse<EmptyObject>

type Deps = ControllerDependencies<{
  adminService: AdminService
  isAdministrativeMode: () => boolean
}>

@Path(buildPath('admin'))
@PreProcessor(requireRank('admin'))
export default class AdminController extends ControllerBase {
  private readonly adminService: AdminService
  private readonly isAdministrativeMode: () => boolean

  constructor (deps: Deps) {
    super(deps, 'admin')
    this.adminService = deps.resolve('adminService')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
  }

  @GET
  @Path('/administrativeMode')
  public getAdministrativeMode (): GetAdministrativeModeResponse {
    const builder = this.registerResponseBuilder<GetAdministrativeModeResponse>('GET /administrativeMode')

    try {
      return builder.success({ isAdministrativeMode: this.isAdministrativeMode() })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/twitch/login')
  public getTwitchLoginUrl (): GetTwitchLoginUrlResponse {
    const builder = this.registerResponseBuilder<GetTwitchLoginUrlResponse>('GET /twitch/login')

    try {
      const url = this.adminService.getTwitchLoginUrl()
      return builder.success({ url })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/twitch/authorise')
  public async authoriseTwitch (
    @QueryParam('code') code: string
  ): Promise<TwitchAuthorisationResponse> {
    const builder = this.registerResponseBuilder<TwitchAuthorisationResponse>('POST /twitch/authorise')

    try {
      await this.adminService.authoriseTwitchLogin(code)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
