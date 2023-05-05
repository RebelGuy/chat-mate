import { ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { GET, Path, PreProcessor } from 'typescript-rest'
import { EmptyObject } from '@rebel/shared/types'
import { requireRank } from '@rebel/server/controllers/preProcessors'
import MasterchatService from '@rebel/server/services/MasterchatService'

export type PingResponse = ApiResponse<EmptyObject>

export type GetMasterchatAuthenticationResponse = ApiResponse<{ authenticated: boolean | null }>

export type GetChatMateRegisteredUsernameResponse = ApiResponse<{ username: string }>

type Deps = ControllerDependencies<{
  masterchatService: MasterchatService
  chatMateRegisteredUserName: string
}>

@Path(buildPath('chatMate'))
export default class ChatMateController extends ControllerBase {
  private readonly masterchatService: MasterchatService
  private readonly chatMateRegisteredUserName: string

  constructor (deps: Deps) {
    super(deps, 'chatMate')
    this.masterchatService = deps.resolve('masterchatService')
    this.chatMateRegisteredUserName = deps.resolve('chatMateRegisteredUserName')
  }

  @GET
  @Path('ping')
  public ping (): PingResponse {
    const builder = this.registerResponseBuilder<PingResponse>('GET /ping')
    return builder.success({})
  }

  @GET
  @Path('masterchat/authentication')
  @PreProcessor(requireRank('admin'))
  public getMasterchatAuthentication (): GetMasterchatAuthenticationResponse {
    const builder = this.registerResponseBuilder<GetMasterchatAuthenticationResponse>('GET /masterchat/authentication')
    try {
      return builder.success({ authenticated: this.masterchatService.checkCredentials() })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/username')
  public getChatMateRegisteredUsername (): GetChatMateRegisteredUsernameResponse {
    const builder = this.registerResponseBuilder<GetChatMateRegisteredUsernameResponse>('GET /username')
    try {
      return builder.success({ username: this.chatMateRegisteredUserName })
    } catch (e: any) {
      return builder.failure(404, e)
    }
  }
}
