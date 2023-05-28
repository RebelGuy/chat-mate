import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicChannelRankChange } from '@rebel/server/controllers/public/rank/PublicChannelRankChange'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { userRankToPublicObject, rankToPublicObject } from '@rebel/server/models/rank'
import LogService from '@rebel/server/services/LogService'
import ModService from '@rebel/server/services/rank/ModService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { single, sortBy } from '@rebel/shared/util/arrays'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { DELETE, GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { isOneOf } from '@rebel/shared/util/validation'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import RankService, { TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { addTime } from '@rebel/shared/util/datetime'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import AccountService from '@rebel/server/services/AccountService'
import UserService from '@rebel/server/services/UserService'
import { channelToPublicChannel } from '@rebel/server/models/user'

export type GetUserRanksResponse = ApiResponse<{ ranks: PublicUserRank[] }>

export type GetAccessibleRanksResponse = ApiResponse<{ accessibleRanks: PublicRank[] }>

type AddUserRankRequest = ApiRequest<{
  userId: number,
  message: string | null,
  durationSeconds: number | null,
  rank: 'famous' | 'donator' | 'supporter' | 'member'
}>
type AddUserRankResponse = ApiResponse<{
  newRank: PublicObject<PublicUserRank>
}>

type RemoveUserRankRequest = ApiRequest<{
  removedByRegisteredUserId: number
  userId: number,
  message: string | null,
  rank: 'famous' | 'donator' | 'supporter' | 'member'
}>
type RemoveUserRankResponse = ApiResponse<{
  removedRank: PublicObject<PublicUserRank>
}>

type AddModRankRequest = ApiRequest<{
  userId: number,
  message: string | null
}>
type AddModRankResponse = ApiResponse<{
  newRank: PublicObject<PublicUserRank> | null
  newRankError: string | null
  channelModChanges: PublicObject<PublicChannelRankChange>[]
}>

type RemoveModRankRequest = ApiRequest<{
  userId: number,
  message: string | null
}>
type RemoveModRankResponse = ApiResponse<{
  removedRank: PublicObject<PublicUserRank> | null
  removedRankError: string | null
  channelModChanges: PublicObject<PublicChannelRankChange>[]
}>

type Deps = ControllerDependencies<{
  logService: LogService
  channelStore: ChannelStore
  modService: ModService
  rankStore: RankStore
  rankService: RankService
  accountService: AccountService
  userService: UserService
}>

@Path(buildPath('rank'))
export default class RankController extends ControllerBase {
  private readonly modService: ModService
  private readonly channelStore: ChannelStore
  private readonly rankStore: RankStore
  private readonly rankService: RankService
  private readonly accountService: AccountService
  private readonly userService: UserService

  constructor (deps: Deps) {
    super(deps, 'rank')
    this.modService = deps.resolve('modService')
    this.channelStore = deps.resolve('channelStore')
    this.rankStore = deps.resolve('rankStore')
    this.rankService = deps.resolve('rankService')
    this.accountService = deps.resolve('accountService')
    this.userService = deps.resolve('userService')
  }

  @GET
  @PreProcessor(requireAuth)
  public async getUserRanks (
    @QueryParam('userId') anyUserId?: number,
    @QueryParam('includeInactive') includeInactive?: boolean // if not set, returns only active ranks
  ): Promise<GetUserRanksResponse> {
    const builder = this.registerResponseBuilder<GetUserRanksResponse>('GET')

    try {
      if (anyUserId == null) {
        anyUserId = this.getCurrentUser().aggregateChatUserId
      }
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)

      let ranks: UserRankWithRelations[]
      if (includeInactive === true) {
        ranks = await this.rankStore.getUserRankHistory(primaryUserId, this.getStreamerId(true))
      } else {
        ranks = single(await this.rankStore.getUserRanks([primaryUserId], this.getStreamerId(true))).ranks
      }

      ranks = sortBy(ranks, p => p.issuedAt.getTime(), 'desc')
      return builder.success({ ranks: ranks.map(e => userRankToPublicObject(e)) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/accessible')
  @PreProcessor(requireStreamer)
  public async getAccessibleRanks (): Promise<GetAccessibleRanksResponse> {
    const builder = this.registerResponseBuilder<GetAccessibleRanksResponse>('GET /accessible')
    const accessibleRanks = await this.rankService.getAccessibleRanks()
    try {
      return builder.success({
        accessibleRanks: accessibleRanks.map(rankToPublicObject)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async addUserRank (request: AddUserRankRequest): Promise<AddUserRankResponse> {
    const builder = this.registerResponseBuilder<AddUserRankResponse>('POST')
    if (request == null || request.userId == null || !isOneOf(request.rank, ...['famous', 'donator', 'supporter', 'member'] as const)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      if (await this.userService.isUserBusy(primaryUserId)) {
        throw new Error('Cannot add the user rank at this time. Please try again later.')
      }

      const args: AddUserRankArgs = {
        rank: request.rank,
        primaryUserId: primaryUserId,
        streamerId: this.getStreamerId(),
        message: request.message,
        expirationTime: request.durationSeconds ? addTime(new Date(), 'seconds', request.durationSeconds) : null,
        assignee: this.getCurrentUser().id
      }
      const result = await this.rankStore.addUserRank(args)

      return builder.success({ newRank: userRankToPublicObject(result) })
    } catch (e: any) {
      if (e instanceof UserRankAlreadyExistsError) {
        return builder.failure(400, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  @DELETE
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async removeUserRank (request: RemoveUserRankRequest): Promise<RemoveUserRankResponse> {
    const builder = this.registerResponseBuilder<RemoveUserRankResponse>('DELETE')
    if (request == null || request.userId == null || !isOneOf(request.rank, ...['famous', 'donator', 'supporter', 'member'] as const)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      if (await this.userService.isUserBusy(primaryUserId)) {
        throw new Error('Cannot renove the user rank at this time. Please try again later.')
      }

      const args: RemoveUserRankArgs = {
        rank: request.rank,
        primaryUserId: primaryUserId,
        streamerId: this.getStreamerId(),
        message: request.message,
        removedBy: this.getCurrentUser().id
      }
      const result = await this.rankStore.removeUserRank(args)

      return builder.success({ removedRank: userRankToPublicObject(result) })
    } catch (e: any) {
      if (e instanceof UserRankNotFoundError) {
        return builder.failure(404, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  @POST
  @Path('/mod')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async addModRank (request: AddModRankRequest): Promise<AddModRankResponse> {
    const builder = this.registerResponseBuilder<AddModRankResponse>('POST /mod')
    if (request == null || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.modService.setModRank(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, true, request.message)
      return builder.success({
        newRank: result.rankResult.rank ==  null ? null : userRankToPublicObject(result.rankResult.rank),
        newRankError: result.rankResult.error,
        channelModChanges: await this.getChannelRankChanges(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @DELETE
  @Path('/mod')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async removeModRank (request: RemoveModRankRequest): Promise<RemoveModRankResponse> {
    const builder = this.registerResponseBuilder<RemoveModRankResponse>('DELETE /mod')
    if (request == null || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.modService.setModRank(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, false, request.message)
      return builder.success({
        removedRank: result.rankResult.rank ==  null ? null : userRankToPublicObject(result.rankResult.rank),
        removedRankError: result.rankResult.error,
        channelModChanges: await this.getChannelRankChanges(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  private async getChannelRankChanges (results: { youtubeResults: YoutubeRankResult[], twitchResults: TwitchRankResult[] }): Promise<PublicChannelRankChange[]> {
    const makePublicResult = async (channelId: number, platform: 'youtube' | 'twitch', error: string | null): Promise<PublicChannelRankChange> => {
      let channel: UserChannel
      if (platform === 'youtube') {
        channel = await this.channelStore.getYoutubeChannelFromChannelId([channelId]).then(single)
      } else if (platform === 'twitch') {
        channel = await this.channelStore.getTwitchChannelFromChannelId([channelId]).then(single)
      } else {
        assertUnreachable(platform)
      }

      return {
        channel: channelToPublicChannel(channel),
        error: error,
      }
    }

    return await Promise.all([
      ...results.youtubeResults.map(c => makePublicResult(c.youtubeChannelId, 'youtube', c.error)),
      ...results.twitchResults.map(c => makePublicResult(c.twitchChannelId, 'twitch', c.error))
    ])
  }
}
