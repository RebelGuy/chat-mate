import { Dependencies } from '@rebel/server/context/context'
import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicChannelRankChange } from '@rebel/server/controllers/public/rank/PublicChannelRankChange'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { userRankToPublicObject, rankToPublicObject } from '@rebel/server/models/rank'
import LogService from '@rebel/server/services/LogService'
import ModService from '@rebel/server/services/rank/ModService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { single, sortBy } from '@rebel/server/util/arrays'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { DELETE, GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { isOneOf } from '@rebel/server/util/validation'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/server/util/error'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import RankService, { TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { addTime } from '@rebel/server/util/datetime'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import AccountService from '@rebel/server/services/AccountService'
import { getUserName } from '@rebel/server/services/ChannelService'

export type GetUserRanksResponse = ApiResponse<1, { ranks: PublicUserRank[] }>

export type GetAccessibleRanksResponse = ApiResponse<1, { accessibleRanks: PublicRank[] }>

type AddUserRankRequest = ApiRequest<1, {
  schema: 1,
  userId: number,
  message: string | null,
  durationSeconds: number | null,
  rank: 'famous' | 'donator' | 'supporter' | 'member'
}>
type AddUserRankResponse = ApiResponse<1, {
  newRank: Tagged<1, PublicUserRank>
}>

type RemoveUserRankRequest = ApiRequest<1, {
  schema: 1,
  removedByRegisteredUserId: number
  userId: number,
  message: string | null,
  rank: 'famous' | 'donator' | 'supporter' | 'member'
}>
type RemoveUserRankResponse = ApiResponse<1, {
  removedRank: Tagged<1, PublicUserRank>
}>

type AddModRankRequest = ApiRequest<1, {
  schema: 1,
  userId: number,
  message: string | null
}>
type AddModRankResponse = ApiResponse<1, {
  newRank: Tagged<1, PublicUserRank> | null
  newRankError: string | null
  channelModChanges: Tagged<1, PublicChannelRankChange>[]
}>

type RemoveModRankRequest = ApiRequest<1, {
  schema: 1,
  userId: number,
  message: string | null
}>
type RemoveModRankResponse = ApiResponse<1, {
  removedRank: Tagged<1, PublicUserRank> | null
  removedRankError: string | null
  channelModChanges: Tagged<1, PublicChannelRankChange>[]
}>

type Deps = ControllerDependencies<{
  logService: LogService
  channelStore: ChannelStore
  modService: ModService
  rankStore: RankStore
  rankService: RankService
  accountService: AccountService
}>

@Path(buildPath('rank'))
export default class RankController extends ControllerBase {
  private readonly modService: ModService
  private readonly channelStore: ChannelStore
  private readonly rankStore: RankStore
  private readonly rankService: RankService
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super(deps, 'rank')
    this.modService = deps.resolve('modService')
    this.channelStore = deps.resolve('channelStore')
    this.rankStore = deps.resolve('rankStore')
    this.rankService = deps.resolve('rankService')
    this.accountService = deps.resolve('accountService')
  }

  @GET
  @PreProcessor(requireAuth)
  public async getUserRanks (
    @QueryParam('userId') anyUserId?: number,
    @QueryParam('includeInactive') includeInactive?: boolean // if not set, returns only active ranks
  ): Promise<GetUserRanksResponse> {
    const builder = this.registerResponseBuilder<GetUserRanksResponse>('GET', 1)

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
    const builder = this.registerResponseBuilder<GetAccessibleRanksResponse>('GET /accessible', 1)
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
    const builder = this.registerResponseBuilder<AddUserRankResponse>('POST', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null || !isOneOf(request.rank, ...['famous', 'donator', 'supporter', 'member'] as const)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
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
    const builder = this.registerResponseBuilder<RemoveUserRankResponse>('DELETE', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null || !isOneOf(request.rank, ...['famous', 'donator', 'supporter', 'member'] as const)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
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
    const builder = this.registerResponseBuilder<AddModRankResponse>('POST /mod', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
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
    const builder = this.registerResponseBuilder<RemoveModRankResponse>('DELETE /mod', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
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
        schema: 1,
        channelId: channelId,
        platform: platform,
        error: error,
        channelName: getUserName(channel)
      }
    }

    return await Promise.all([
      ...results.youtubeResults.map(c => makePublicResult(c.youtubeChannelId, 'youtube', c.error)),
      ...results.twitchResults.map(c => makePublicResult(c.twitchChannelId, 'twitch', c.error))
    ])
  }
}
