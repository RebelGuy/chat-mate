import { RankName, RegisteredUser, Streamer, UserRank } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService, { UserLevel } from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import AccountStore from '@rebel/server/stores/AccountStore'
import { UserChannel } from '@rebel/server/stores/ChannelStore'
import RankStore, { UserRanks } from '@rebel/server/stores/RankStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single, unique, zipOnStrictMany } from '@rebel/shared/util/arrays'
import { InvalidUsernameError, PreProcessorError } from '@rebel/shared/util/error'
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
  channelService: ChannelService
  experienceService: ExperienceService
  logService: LogService
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

    const user = this.registeredUser
    if (user == null) {
      throw new Error('Context user must be set')
    }

    const streamerHeader = this.request.headers[STREAMER_HEADER.toLowerCase()]
    if (streamerHeader == null) {
      if (optional) {
        return
      } else {
        throw new PreProcessorError(401, `The ${STREAMER_HEADER} header is required for this endpoint.`)
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

    const userRanks = single(await this.rankStore.getUserRanks([user.aggregateChatUserId], this.streamerId))
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

  public async getAllData (primaryUserIds: number[]): Promise<(UserChannel & UserRanks & UserLevel & { registeredUser: RegisteredUser | null })[]> {
    if (primaryUserIds.length === 0) {
      return []
    }

    primaryUserIds = unique(primaryUserIds)
    const activeUserChannels = await this.channelService.getActiveUserChannels(this.getStreamerId(), primaryUserIds)
      .then(channels => channels.map(c => ({ ...c, primaryUserId: getPrimaryUserId(c) })))
    const levels = await this.experienceService.getLevels(this.getStreamerId(), primaryUserIds)
    const ranks = await this.rankStore.getUserRanks(primaryUserIds, this.getStreamerId())
    const registeredUsers = await this.accountStore.getRegisteredUsers(primaryUserIds)

    try {
      return zipOnStrictMany(activeUserChannels, 'primaryUserId', levels, ranks, registeredUsers)
    } catch (e: any) {
      this.logService.logError(this, `Failed to get all data for primaryUserIds [${primaryUserIds.join(', ')}]. Most likely one or more of the ids were not primary (leading to duplicate effective primary user ids) or a link/unlink was not successful such that fetching data for a (probably default) primary user returned data for another (proabbly aggregate) primary user.`, e)
      throw new Error('Unable to get all data.')
    }
  }
}
