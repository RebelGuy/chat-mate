import { RankName, RegisteredUser, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore from '@rebel/server/stores/RankStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/server/util/arrays'
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
  rankStore: RankStore
}>

// we could do a lot of these things directly in the ControllerBase, but it will be trickier to get the preProcessors to work because we don't know which controller instance from the context to use
export default class ApiService extends ContextClass {
  private readonly accountStore: AccountStore
  private readonly request: Request
  private readonly response: Response
  private readonly streamerStore: StreamerStore
  private readonly accountHelpers: AccountHelpers
  private readonly rankStore: RankStore

  private registeredUser: RegisteredUser | null = null
  private streamerId: number | null = null
  private ranks: RankName[] | null = null

  constructor (deps: Deps) {
    super()
    this.request = deps.resolve('request')
    this.response = deps.resolve('response')
    this.accountStore = deps.resolve('accountStore')
    this.streamerStore = deps.resolve('streamerStore')
    this.accountHelpers = deps.resolve('accountHelpers')
    this.rankStore = deps.resolve('rankStore')
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

  public async hydrateRanks (): Promise<void> {
    if (this.ranks != null) {
      return
    }

    const user = this.registeredUser
    if (user == null) {
      throw new Error('Context user must be set')
    }

    // registered user isn't linked to a chat user
    if (user.chatUserId == null) {
      this.ranks = []
      return
    }

    const userRanks = single(await this.rankStore.getUserRanks([user.chatUserId!], this.streamerId))
    this.ranks = userRanks.ranks.map(r => r.rank.name)
  }

  public getCurrentUser (optional?: false): RegisteredUser
  public getCurrentUser (optional: true): RegisteredUser | null
  public getCurrentUser (optional?: boolean): RegisteredUser | null {
    if (!optional && this.registeredUser == null) {
      throw new Error('Current user is required but null - ensure you are using the `requireAuth` pre-processor.')
    }

    return this.registeredUser
  }

  public getStreamerId (optional?: false): number
  public getStreamerId (optional: true): number | null
  public getStreamerId (optional?: boolean): number | null {
    if (!optional && this.streamerId == null) {
      throw new Error('StreamerId is required but null - ensure you are using the `requireStreamer` pre-processor.')
    }

    return this.streamerId
  }

  public getRanks (): RankName[] | null {
    return this.ranks
  }

  /** Checks whether the user has the *exact* rank. Throws if `hydrateRanks()` has not been called yet. */
  public hasRank (rank: RankName): boolean {
    return this.ranks!.includes(rank)
  }

  /** Checks whether the user has the rank, or haigher. Throws if `hydrateRanks()` has not been called yet. */
  public hasRankOrAbove (rank: RankName): boolean {
    if (this.ranks!.includes('admin')) {
      return true
    }

    // todo: implement rank hierarchy
    return this.ranks!.includes(rank)
  }
}
