import ChatControllerReal, { ChatControllerDeps } from '@rebel/server/controllers/ChatControllerReal'
import ChatControllerFake from '@rebel/server/controllers/ChatControllerFake'
import { buildPath, ControllerBase, Endpoint } from '@rebel/server/controllers/ControllerBase'
import env from '@rebel/server/globals'
import { GET, Path, PathParam, PreProcessor, QueryParam } from 'typescript-rest'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime'
import { GetChatResponse, GetCommandStatusResponse } from '@rebel/api-models/schema/chat'
import { isKnownPrismaError, PRISMA_CODE_DOES_NOT_EXIST } from '@rebel/server/prismaUtil'

export type GetChatEndpoint = Endpoint<{ since?: number, limit?: number }, GetChatResponse>

export type GetCommandStatusEndpoint = Endpoint<{ commandId: number }, GetCommandStatusResponse>

export interface IChatController {
  getChat: GetChatEndpoint
  getCommandStatus: GetCommandStatusEndpoint
}

@Path(buildPath('chat'))
@PreProcessor(requireStreamer)
export default class ChatController extends ControllerBase {
  private readonly implementation: IChatController

  constructor (deps: ChatControllerDeps) {
    super(deps, 'chat')
    const useFakeControllers = env('useFakeControllers')
    this.implementation = useFakeControllers ? new ChatControllerFake(deps) : new ChatControllerReal(deps)
  }

  @GET
  public async getChat (
    // unix timestamp (milliseconds)
    @QueryParam('since') since?: number,
    @QueryParam('limit') limit?: number
  ): Promise<GetChatResponse> {
    const builder = this.registerResponseBuilder<GetChatResponse>('GET /')
    try {
      return await this.implementation.getChat({
        builder,
        since,
        limit: limit == null || limit > 100 ? 100 : limit
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/command/:commandId')
  @PreProcessor(requireRank('owner'))
  public async getCommandStatus (
    @PathParam('commandId') commandId: number
  ): Promise<GetCommandStatusResponse> {
    const builder = this.registerResponseBuilder<GetCommandStatusResponse>('GET /command/:commandId')

    if (commandId == null) {
      return builder.failure(400, 'CommandId must be provided.')
    }

    try {
      return await this.implementation.getCommandStatus({ builder, commandId })
    } catch (e: any) {
      if (isKnownPrismaError(e) && e.innerError.code === PRISMA_CODE_DOES_NOT_EXIST) {
        return builder.failure(404, 'Command not found.')
      } else {
        return builder.failure(e)
      }
    }
  }
}
