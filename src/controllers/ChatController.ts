import { Request, Response, Router } from "express"
import { GET, Path, PathParam, QueryParam } from "typescript-rest"
import Endpoint, { BASE_PATH, buildPath } from "./BaseEndpoint.js"

@Path(buildPath('chat'))
export class ChatController {
  @GET
  public getChat (@ QueryParam('test') test: string
  ): string {
    return 'test response' + test
  }
}
