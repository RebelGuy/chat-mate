import { ApiRequest, ApiResponse, buildPath, ControllerBase, Endpoint, PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import { GET, PATCH, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import env from '@rebel/server/globals'
import ChatMateControllerReal, { ChatMateControllerDeps } from '@rebel/server/controllers/ChatMateControllerReal'
import ChatMateControllerFake from '@rebel/server/controllers/ChatMateControllerFake'
import { EmptyObject } from '@rebel/shared/types'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'

export type PingResponse = ApiResponse<EmptyObject>

export type GetStatusResponse = ApiResponse<{
  livestreamStatus: PublicObject<PublicLivestreamStatus> | null
  youtubeApiStatus: PublicObject<PublicApiStatus>
  twitchApiStatus: PublicObject<PublicApiStatus>
}>

type GetEventsResponse = ApiResponse<{
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  events: PublicObject<PublicChatMateEvent>[]
}>

// eslint-disable-next-line @typescript-eslint/ban-types
export type GetStatusEndpoint = Endpoint<{}, GetStatusResponse>

export type GetEventsEndpoint = Endpoint<{ since: number }, GetEventsResponse>

export type SetActiveLivestreamRequest = ApiRequest<{ livestream: string | null }>
export type SetActiveLivestreamResponse = ApiResponse<{ livestreamLink: string | null }>
export type SetActiveLivestreamEndpoint = Endpoint<SetActiveLivestreamRequest, SetActiveLivestreamResponse>

export type GetMasterchatAuthenticationResponse = ApiResponse<{ authenticated: boolean | null }>
// eslint-disable-next-line @typescript-eslint/ban-types
export type GetMasterchatAuthenticationEndpoint = Endpoint<{}, GetMasterchatAuthenticationResponse>

export interface IChatMateController {
  getStatus: GetStatusEndpoint
  getEvents: GetEventsEndpoint
  setActiveLivestream: SetActiveLivestreamEndpoint
  getMasterchatAuthentication: GetMasterchatAuthenticationEndpoint
}

@Path(buildPath('chatMate'))
export default class ChatMateController extends ControllerBase {
  private readonly implementation: IChatMateController

  constructor (deps: ChatMateControllerDeps) {
    super(deps, 'chatMate')
    const useFakeControllers = env('useFakeControllers')
    this.implementation = useFakeControllers ? new ChatMateControllerFake(deps) : new ChatMateControllerReal(deps)
  }

  @GET
  @Path('ping')
  public ping (): PingResponse {
    const builder = this.registerResponseBuilder<PingResponse>('GET /ping')
    return builder.success({})
  }

  @GET
  @Path('status')
  @PreProcessor(requireStreamer)
  public async getStatus (): Promise<GetStatusResponse> {
    const builder = this.registerResponseBuilder<GetStatusResponse>('GET /status')
    try {
      return await this.implementation.getStatus({ builder })
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
      return await this.implementation.getEvents({ builder, since })
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
      return await this.implementation.setActiveLivestream({ builder, ...request })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('masterchat/authentication')
  @PreProcessor(requireRank('admin'))
  public async getMasterchatAuthentication (): Promise<GetMasterchatAuthenticationResponse> {
    const builder = this.registerResponseBuilder<GetMasterchatAuthenticationResponse>('GET /masterchat/authentication')
    try {
      return await this.implementation.getMasterchatAuthentication({ builder })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
