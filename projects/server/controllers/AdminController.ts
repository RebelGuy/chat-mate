import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireRank } from '@rebel/server/controllers/preProcessors'
import HelixEventService from '@rebel/server/services/HelixEventService'
import AdminService from '@rebel/server/services/rank/AdminService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import { GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { GetAdministrativeModeResponse, GetLinkAttemptLogsResponse, GetTwitchLoginUrlResponse, GetYoutubeLoginUrlResponse, ReconnectTwitchChatClientResponse, ReleaseLinkAttemptResponse, ResetTwitchSubscriptionsResponse, TwitchAuthorisationResponse, YoutubeAuthorisationResponse } from '@rebel/api-models/schema/admin'
import LinkStore from '@rebel/server/stores/LinkStore'
import { PublicLinkAttemptLog } from '@rebel/api-models/public/user/PublicLinkAttemptLog'
import { PublicLinkAttemptStep } from '@rebel/api-models/public/user/PublicLinkAttemptStep'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'

type Deps = ControllerDependencies<{
  adminService: AdminService
  isAdministrativeMode: () => boolean
  twurpleService: TwurpleService
  helixEventService: HelixEventService
  linkStore: LinkStore
  youtubeAuthProvider: YoutubeAuthProvider
}>

@Path(buildPath('admin'))
@PreProcessor(requireRank('admin'))
export default class AdminController extends ControllerBase {
  private readonly adminService: AdminService
  private readonly isAdministrativeMode: () => boolean
  private readonly twurpleService: TwurpleService
  private readonly helixEventService: HelixEventService
  private readonly linkStore: LinkStore
  private readonly youtubeAuthProvider: YoutubeAuthProvider

  constructor (deps: Deps) {
    super(deps, 'admin')
    this.adminService = deps.resolve('adminService')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
    this.twurpleService = deps.resolve('twurpleService')
    this.helixEventService = deps.resolve('helixEventService')
    this.linkStore = deps.resolve('linkStore')
    this.youtubeAuthProvider = deps.resolve('youtubeAuthProvider')
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

  @GET
  @Path('/youtube/login')
  public async getTYoutubeLoginUrl (): Promise<GetYoutubeLoginUrlResponse> {
    const builder = this.registerResponseBuilder<GetYoutubeLoginUrlResponse>('GET /youtube/login')

    try {
      const url = this.youtubeAuthProvider.getAuthUrl(true)
      const youtubeChannelName = await this.adminService.getYoutubeChannelName()
      return builder.success({ url, youtubeChannelName })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/youtube/authorise')
  public async authoriseYoutube (
    @QueryParam('code') code: string
  ): Promise<YoutubeAuthorisationResponse> {
    const builder = this.registerResponseBuilder<YoutubeAuthorisationResponse>('POST /youtube/authorise')

    try {
      await this.youtubeAuthProvider.authoriseChannel(code, 'admin')
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/link/logs')
  public async getLinkAttemptLogs (): Promise<GetLinkAttemptLogsResponse> {
    const builder = this.registerResponseBuilder<GetLinkAttemptLogsResponse>('GET /link/log')

    try {
      const result = await this.linkStore.getLinkAttempts()
      return builder.success({ logs: result.map<PublicLinkAttemptLog>(attempt => ({
        id: attempt.id,
        startTime: attempt.startTime.getTime(),
        endTime: attempt.endTime?.getTime() ?? null,
        errorMessage: attempt.errorMessage,
        defaultChatUserId: attempt.defaultChatUserId,
        aggregateChatUserId: attempt.aggregateChatUserId,
        steps: (JSON.parse(attempt.log) as [string, string, number][]).map<PublicLinkAttemptStep>(log => ({
          timestamp: new Date(log[0]).getTime(),
          description: log[1],
          accumulatedWarnings: log[2]
        })),
        type: attempt.type,
        linkToken: attempt.linkToken?.token ?? null,
        released: attempt.released
      }))})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/link/release')
  public async releaseLinkAttempt (
    @QueryParam('linkAttemptId') linkAttemptId: number
  ): Promise<ReleaseLinkAttemptResponse> {
    const builder = this.registerResponseBuilder<ReleaseLinkAttemptResponse>('POST /link/release')

    try {
      await this.linkStore.releaseLink(linkAttemptId)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
