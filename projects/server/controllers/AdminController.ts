import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireRank } from '@rebel/server/controllers/preProcessors'
import HelixEventService from '@rebel/server/services/HelixEventService'
import AdminService from '@rebel/server/services/rank/AdminService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import { GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { GetAdministrativeModeResponse, GetTwitchLoginUrlResponse, ReconnectTwitchChatClientResponse, ResetTwitchSubscriptionsResponse, TwitchAuthorisationResponse } from '@rebel/api-models/schema/admin'

type Deps = ControllerDependencies<{
  adminService: AdminService
  isAdministrativeMode: () => boolean
  twurpleService: TwurpleService
  helixEventService: HelixEventService
}>

@Path(buildPath('admin'))
@PreProcessor(requireRank('admin'))
export default class AdminController extends ControllerBase {
  private readonly adminService: AdminService
  private readonly isAdministrativeMode: () => boolean
  private readonly twurpleService: TwurpleService
  private readonly helixEventService: HelixEventService

  constructor (deps: Deps) {
    super(deps, 'admin')
    this.adminService = deps.resolve('adminService')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
    this.twurpleService = deps.resolve('twurpleService')
    this.helixEventService = deps.resolve('helixEventService')
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
      const twitchUsername = this.adminService.getTwitchUsername()
      return builder.success({ url, twitchUsername })
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

  @POST
  @Path('/twitch/reconnectChatClient')
  public async reconnectTwitchChatClient (): Promise<ReconnectTwitchChatClientResponse> {
    const builder = this.registerResponseBuilder<ReconnectTwitchChatClientResponse>('POST /twitch/reconnectChatClient')

    try {
      await this.twurpleService.reconnectClient()
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/twitch/resetSubscriptions')
  public async resetSubscriptions (): Promise<ResetTwitchSubscriptionsResponse> {
    const builder = this.registerResponseBuilder<ResetTwitchSubscriptionsResponse>('POST /twitch/resetSubscriptions')

    try {
      await this.helixEventService.resetAllSubscriptions()
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
