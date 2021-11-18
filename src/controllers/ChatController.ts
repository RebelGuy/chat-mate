import { Dependencies } from '@context/ContextProvider'
import { buildPath } from '@controllers/BaseEndpoint'
import { GET, Path, QueryParam } from "typescript-rest"
import ChatStore from "../stores/ChatStore"

@Path(buildPath('chat'))
export class ChatController {
  readonly chatStore: ChatStore

  constructor (dependencies: Dependencies) {
    console.log(dependencies)
    this.chatStore = dependencies.getInstance<ChatStore>(ChatStore.name)
  }

  @GET
  public getChat (
    @ QueryParam('test') test: string
  ): string {
    console.log(this)
    return `dependency injection successful: ${this.chatStore != null}`
  }
}
