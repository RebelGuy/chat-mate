import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import { single, sortBy } from '@rebel/server/util/arrays'
import { Path, GET, QueryParam, POST, PathParam, PreProcessor } from 'typescript-rest'
import { YOUTUBE_TIMEOUT_DURATION } from '@rebel/server/services/YoutubeTimeoutRefreshService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { PublicChannelRankChange } from '@rebel/server/controllers/public/rank/PublicChannelRankChange'
import { TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/server/util/error'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import AccountService from '@rebel/server/services/AccountService'
import { getUserName } from '@rebel/server/services/ChannelService'

export type GetSinglePunishment = ApiResponse<2, { punishment: Tagged<1, PublicUserRank> }>

export type GetUserPunishments = ApiResponse<2, { punishments: Tagged<1, PublicUserRank>[] }>

export type BanUserRequest = ApiRequest<4, { schema: 4, userId: number, message: string | null }>
export type BanUserResponse = ApiResponse<4, {
  newPunishment: Tagged<1, PublicUserRank> | null
  newPunishmentError: string | null
  channelPunishments: Tagged<1, PublicChannelRankChange>[]
}>

export type UnbanUserRequest = ApiRequest<4, { schema: 4, userId: number, message: string | null }>
export type UnbanUserResponse = ApiResponse<4, {
  removedPunishment: Tagged<1, PublicUserRank> | null
  removedPunishmentError: string | null
  channelPunishments: Tagged<1, PublicChannelRankChange>[]
}>

export type TimeoutUserRequest = ApiRequest<4, { schema: 4, userId: number, message: string | null, durationSeconds: number }>
export type TimeoutUserResponse = ApiResponse<4, {
  newPunishment: Tagged<1, PublicUserRank> | null
  newPunishmentError: string | null
  channelPunishments: Tagged<1, PublicChannelRankChange>[]
}>

export type RevokeTimeoutRequest = ApiRequest<4, { schema: 4, userId: number, message: string | null }>
export type RevokeTimeoutResponse = ApiResponse<4, {
  removedPunishment: Tagged<1, PublicUserRank> | null
  removedPunishmentError: string | null
  channelPunishments: Tagged<1, PublicChannelRankChange>[]
}>

export type MuteUserRequest = ApiRequest<2, { schema: 2, userId: number, message: string | null, durationSeconds: number | null }>
export type MuteUserResponse = ApiResponse<2, { newPunishment: Tagged<1, PublicUserRank> }>

export type UnmuteUserRequest = ApiRequest<3, { schema: 3, userId: number, message: string | null }>
export type UnmuteUserResponse = ApiResponse<3, { removedPunishment: Tagged<1, PublicUserRank> }>

type Deps = ControllerDependencies<{
  rankStore: RankStore
  punishmentService: PunishmentService
  channelStore: ChannelStore
  accountService: AccountService
}>

@Path(buildPath('punishment'))
@PreProcessor(requireStreamer)
@PreProcessor(requireRank('mod'))
export default class PunishmentController extends ControllerBase {
  private readonly rankStore: RankStore
  private readonly punishmentService: PunishmentService
  private readonly channelStore: ChannelStore
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super(deps, 'punishment')
    this.rankStore = deps.resolve('rankStore')
    this.punishmentService = deps.resolve('punishmentService')
    this.channelStore = deps.resolve('channelStore')
    this.accountService = deps.resolve('accountService')
  }

  @GET
  @Path('/:id')
  public async getSinglePunishment (
    @PathParam('id') id: number
  ): Promise<GetSinglePunishment> {
    const builder = this.registerResponseBuilder<GetSinglePunishment>('GET /:id', 2)
    try {
      const punishment = await this.rankStore.getUserRankById(id)
      if (punishment == null || punishment.streamerId !== this.getStreamerId()) {
        return builder.failure(404, `Cannot find an active punishment with id ${id}.`)
      } else {
        return builder.success({ punishment: userRankToPublicObject(punishment) })
      }
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  public async getPunishments (
    @QueryParam('userId') anyUserId?: number, // if not provided, returns punishments of all users
    @QueryParam('includeInactive') includeInactive?: boolean // if not set, returns only active punishments
  ): Promise<GetUserPunishments> {
    const builder = this.registerResponseBuilder<GetUserPunishments>('GET', 2)
    try {
      const primaryUserId = anyUserId == null ? null : await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)

      let punishments: UserRankWithRelations[]
      if (includeInactive === true) {
        if (primaryUserId == null) {
          return builder.failure(400, 'A user ID must be provided when getting the punishment history')
        }
        punishments = await this.punishmentService.getPunishmentHistory(primaryUserId, this.getStreamerId())

      } else {
        punishments = await this.punishmentService.getCurrentPunishments(this.getStreamerId())
        if (anyUserId != null) {
          punishments = punishments.filter(p => p.primaryUserId === primaryUserId)
        }
      }

      punishments = sortBy(punishments, p => p.issuedAt.getTime(), 'desc')
      return builder.success({ punishments: punishments.map(e => userRankToPublicObject(e)) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/ban')
  public async banUser (request: BanUserRequest): Promise<BanUserResponse> {
    const builder = this.registerResponseBuilder<BanUserResponse>('POST /ban', 4)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.banUser(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, request.message)
      return builder.success({
        newPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank),
        newPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/unban')
  public async unbanUser (request: UnbanUserRequest): Promise<UnbanUserResponse> {
    const builder = this.registerResponseBuilder<UnbanUserResponse>('POST /unban', 4)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.unbanUser(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, request.message)
      return builder.success({
        removedPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank),
        removedPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/timeout')
  public async timeoutUser (request: TimeoutUserRequest): Promise<TimeoutUserResponse> {
    const builder = this.registerResponseBuilder<TimeoutUserResponse>('POST /timeout', 4)
    const minDuration = YOUTUBE_TIMEOUT_DURATION / 1000
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    } else if (request.durationSeconds == null || request.durationSeconds < minDuration) {
      return builder.failure(400, `Duration must be at least ${minDuration} seconds.`)
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.timeoutUser(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, request.message, request.durationSeconds)
      return builder.success({
        newPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank),
        newPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/revokeTimeout')
  public async revokeTimeout (request: RevokeTimeoutRequest): Promise<RevokeTimeoutResponse> {
    const builder = this.registerResponseBuilder<RevokeTimeoutResponse>('POST /revokeTimeout', 4)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.untimeoutUser(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, request.message)
      return builder.success({
        removedPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank),
        removedPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/mute')
  public async muteUser (request: MuteUserRequest): Promise<MuteUserResponse> {
    const builder = this.registerResponseBuilder<MuteUserResponse>('POST /mute', 2)
    if (request == null || request.schema !== builder.schema || request.userId == null || (request.durationSeconds != null && request.durationSeconds < 0)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const duration = request.durationSeconds == null || request.durationSeconds === 0 ? null : request.durationSeconds
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.muteUser(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, request.message, duration)
      return builder.success({ newPunishment: userRankToPublicObject(result) })
    } catch (e: any) {
      if (e instanceof UserRankAlreadyExistsError) {
        return builder.failure(400, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  @POST
  @Path('/unmute')
  public async unmuteUser (request: UnmuteUserRequest): Promise<UnmuteUserResponse> {
    const builder = this.registerResponseBuilder<UnmuteUserResponse>('POST /unmute', 3)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.unmuteUser(primaryUserId, this.getStreamerId(), this.getCurrentUser().id, request.message)
      return builder.success({ removedPunishment: userRankToPublicObject(result) })
    } catch (e: any) {
      if (e instanceof UserRankNotFoundError) {
        return builder.failure(404, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  private async getChannelPunishments (results: { youtubeResults: YoutubeRankResult[], twitchResults: TwitchRankResult[] }): Promise<PublicChannelRankChange[]> {
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
