import { RankName, RegisteredUser, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AccountHelpers from '@rebel/shared/helpers/AccountHelpers'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore from '@rebel/server/stores/RankStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single, unique, zipOnStrictMany } from '@rebel/shared/util/arrays'
import { ChatMateError, PreProcessorError } from '@rebel/shared/util/error'
import { Request, Response } from 'express'
import ChatStore from '@rebel/server/stores/ChatStore'
import { AllUserData } from '@rebel/server/models/user'
import VisitorService from '@rebel/server/services/VisitorService'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'

const STREAMER_HEADER = 'X-Streamer'

type Deps = Dependencies<{
  request: Request
  response: Response
  accountStore: AccountStore
  streamerStore: StreamerStore
  accountHelpers: AccountHelpers
  rankStore: RankStore
  channelService: ChannelService
  experienceService: ExperienceService
  logService: LogService
  chatStore: ChatStore
  visitorService: VisitorService
  studioUrl: string
}>

// we could do a lot of these things directly in the ControllerBase, but it will be trickier to get the preProcessors to work because we don't know which controller instance from the context to use
export default class ApiService extends ContextClass {
  public readonly name = ApiService.name

  private readonly accountStore: AccountStore
  private readonly request: Request
  private readonly response: Response
  private readonly streamerStore: StreamerStore
  private readonly accountHelpers: AccountHelpers
  private readonly rankStore: RankStore
  private readonly channelService: ChannelService
  private readonly experienceService: ExperienceService
  private readonly logService: LogService
  private readonly chatStore: ChatStore
  private readonly visitorService: VisitorService
  private readonly studioUrl: string

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
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
    this.logService = deps.resolve('logService')
    this.chatStore = deps.resolve('chatStore')
    this.visitorService = deps.resolve('visitorService')
    this.studioUrl = deps.resolve('studioUrl')
  }

  public override initialise (): void {
    // persist the visitor that hits any API endpoint from ChatMate Studio
    if (this.request.get('Origin') === this.studioUrl) {
      void this.visitorService.addVisitor(this.getClientIp())
    }
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

  /** If this method runs to completion, `getStreamerId()` will return a valid streamer ID, or, if optional=true, the id may be null.
 * @throws {@link PreProcessorError}: When the streamer ID could not be extracted. */
  public async extractStreamerId (optional: boolean): Promise<void> {
    if (this.streamerId != null) {
      return
    }

    const streamerHeader = this.request.headers[STREAMER_HEADER.toLowerCase()]
    if (streamerHeader == null) {
      if (optional) {
        return
      } else {
        throw new PreProcessorError(400, `The ${STREAMER_HEADER} header is required for this endpoint.`)
      }
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
      throw new PreProcessorError(400, 'Invalid streamer selected.')
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
      throw new ChatMateError('Context user must be set')
    }

    const userRanks = single(await this.rankStore.getUserRanks([user.aggregateChatUserId], this.streamerId))
    this.ranks = userRanks.ranks.map(r => r.rank.name)
  }

  public getCurrentUser (optional?: false): RegisteredUser
  public getCurrentUser (optional: true): RegisteredUser | null
  public getCurrentUser (optional?: boolean): RegisteredUser | null {
    if (!optional && this.registeredUser == null) {
      throw new ChatMateError('Current user is required but null - ensure you are using the `requireAuth` pre-processor.')
    }

    return this.registeredUser
  }

  public getStreamerId (optional?: false): number
  public getStreamerId (optional: true): number | null
  public getStreamerId (optional?: boolean): number | null {
    if (!optional && this.streamerId == null) {
      throw new ChatMateError('StreamerId is required but null - ensure you are using the `requireStreamer` pre-processor.')
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

  public async getAllData (primaryUserIds: number[]): Promise<AllUserData[]>
  public async getAllData (primaryUserIds: number[], streamerId: number): Promise<AllUserData[]>
  public async getAllData (primaryUserIds: number[], streamerId?: number): Promise<AllUserData[]> {
    if (primaryUserIds.length === 0) {
      return []
    }

    primaryUserIds = unique(primaryUserIds)
    streamerId = streamerId ?? this.getStreamerId()

    // it's not pretty but it's efficient!
    const [activeUserChannels, levels, ranks, registeredUsers, firstSeen, customRankNames] = await Promise.all([
      this.channelService.getActiveUserChannels(streamerId, primaryUserIds)
        .then(channels => channels.map(c => ({ ...c, primaryUserId: getPrimaryUserId(c) }))),
      this.experienceService.getLevels(streamerId, primaryUserIds),
      this.rankStore.getUserRanks(primaryUserIds, streamerId),
      this.accountStore.getRegisteredUsers(primaryUserIds),
      this.chatStore.getTimeOfFirstChat(streamerId, primaryUserIds),
      this.rankStore.getCustomRankNamesForUsers(streamerId, primaryUserIds)
    ])

    try {
      return zipOnStrictMany(activeUserChannels, 'primaryUserId', levels, ranks, registeredUsers, firstSeen, customRankNames)
    } catch (e: any) {
      this.logService.logError(this, `Failed to get all data for primaryUserIds [${primaryUserIds.join(', ')}]. Most likely one or more of the ids were not primary (leading to duplicate effective primary user ids) or a link/unlink was not successful such that fetching data for a (probably default) primary user returned data for another (proabbly aggregate) primary user.`, e)
      throw new ChatMateError('Unable to get all data.')
    }
  }

  public getRequest (): Request {
    return this.request
  }

  public getResponse (): Response {
    return this.response
  }

  public getClientIp (): string {
    return (this.request.get('x-client-ip') as string | undefined) ?? this.request.ip ?? '<unknown IP>'
  }
}
