import { RegisteredUser, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { InvalidUsernameError, PreProcessorError } from '@rebel/server/util/error'
import { Request, Response } from 'express'
import { Errors } from 'typescript-rest'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'

const STREAMER_HEADER = 'X-Streamer'

type Deps = Dependencies<{
  request: Request
  response: Response
  accountStore: AccountStore
  streamerStore: StreamerStore
  accountHelpers: AccountHelpers
}>

// we could do a lot of these things directly in the ControllerBase, but it will be trickier to get the preProcessors to work because we don't know which controller instance from the context to use
export default class ApiService extends ContextClass {
  private readonly accountStore: AccountStore
  private readonly request: Request
  private readonly response: Response
  private readonly streamerStore: StreamerStore
  private readonly accountHelpers: AccountHelpers

  private registeredUser: RegisteredUser | null = null
  private streamerId: number | null = null

  constructor (deps: Deps) {
    super()
    this.request = deps.resolve('request')
    this.response = deps.resolve('response')
    this.accountStore = deps.resolve('accountStore')
    this.streamerStore = deps.resolve('streamerStore')
    this.accountHelpers = deps.resolve('accountHelpers')
  }

  /** If this method runs to completion, `getCurrentUser` will return a non-null object.
   * @throws {@link PreProcessorError}: When the user could not be authenticated. */
  public async authenticateCurrentUser (): Promise<void> {
    const loginToken = this.request.headers[LOGIN_TOKEN_HEADER.toLowerCase()]
    if (loginToken == null) {
      throw new PreProcessorError(401, `The ${LOGIN_TOKEN_HEADER} header is required for authentication.`)
    } else if (Array.isArray(loginToken)) {
      throw new PreProcessorError(400, `The ${LOGIN_TOKEN_HEADER} header was malformed.`)
    }

    this.registeredUser = await this.accountStore.getRegisteredUserFromToken(loginToken)

    if (this.registeredUser == null) {
      throw new PreProcessorError(401, 'Invalid login session. Please login again.')
    }
  }

  /** If this method runs to completion, `getStreamerId()` will return a valid streamer ID of which the current user is a Viewer.
 * @throws {@link PreProcessorError}: When the streamer ID could not be extracted. */
  public async extractStreamerId (): Promise<void> {
    const user = this.registeredUser
    if (user == null) {
      throw new Error('Context user must be set')
    }

    const streamerHeader = this.request.headers[STREAMER_HEADER.toLowerCase()]
    if (streamerHeader == null) {
      throw new PreProcessorError(401, `The ${STREAMER_HEADER} header is required for this endpoint.`)
    } else if (Array.isArray(streamerHeader)) {
      throw new PreProcessorError(400, `The ${STREAMER_HEADER} header was malformed.`)
    }

    let streamer: Streamer | null = null
    try {
      const username = this.accountHelpers.validateAndFormatUsername(streamerHeader)
      streamer = await this.streamerStore.getStreamerByName(username)
    } catch (e: any) {
      // ignore
    }

    if (streamer == null) {
      throw new PreProcessorError(400, 'Invalid stream selected.')
    }

    // todo: CHAT-481 check if the user is a viewer for this stream
    this.streamerId = streamer.id
  }

  public getCurrentUser (): RegisteredUser | null {
    return this.registeredUser
  }

  public getStreamerId (): number | null {
    return this.streamerId
  }
}
