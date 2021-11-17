import { Request, Response, Router } from "express"
import { GET, Path, PathParam, QueryParam } from "typescript-rest"
import ChatStore from "../ChatStore"
import { Dependencies } from "../ContextProvider"
import Endpoint, { BASE_PATH, buildPath } from "./BaseEndpoint"

@Path(buildPath('chat'))
export class ChatController {
  readonly chatStore: ChatStore

  constructor (dependencies: Dependencies) {
    console.log(dependencies)
    this.chatStore = dependencies.getInstance(ChatStore.name)
  }

  @GET
  public getChat (
    @ QueryParam('test') test: string
  ): string {
    console.log(this)
    return `dependency injection successful: ${this.chatStore != null}`
  }
}
