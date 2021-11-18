import { Dependencies } from '@rebel/context/ContextProvider'
import { buildPath } from '@rebel/controllers/BaseEndpoint'
import ChatStore from '@rebel/stores/ChatStore'
import { GET, Path, QueryParam } from "typescript-rest"

@Path(buildPath('chat'))
export class ChatController {
  readonly chatStore: ChatStore

  constructor (dependencies: Dependencies) {
    console.log(dependencies)
    this.chatStore = dependencies.resolve<ChatStore>(ChatStore.name)
    console.log('port:', dependencies.resolve<number>('port'))
  }

  @GET
  public getChat (
    @ QueryParam('test') test: string
  ): string {
    console.log(this)
    return `dependency injection successful: ${this.chatStore != null}`
  }
}
