import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import PunishmentService, { TwitchPunishmentResult, YoutubePunishmentResult } from '@rebel/server/services/rank/PunishmentService'
import { sortBy } from '@rebel/server/util/arrays'
import { Path, GET, QueryParam, POST, PathParam } from 'typescript-rest'
import { YOUTUBE_TIMEOUT_DURATION } from '@rebel/server/services/YoutubeTimeoutRefreshService'
import { PublicChannelPunishment } from '@rebel/server/controllers/public/punishment/PublicChannelPunishment'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { userRankToPublicObject } from '@rebel/server/models/rank'

export type GetSinglePunishment = ApiResponse<2, { punishment: Tagged<1, PublicUserRank> }>

export type GetUserPunishments = ApiResponse<2, { punishments: Tagged<1, PublicUserRank>[] }>

export type BanUserRequest = ApiRequest<3, { schema: 3, userId: number, message: string | null }>
export type BanUserResponse = ApiResponse<3, {
  newPunishment: Tagged<1, PublicUserRank>
  channelPunishments: Tagged<1, PublicChannelPunishment>[]
}>

export type UnbanUserRequest = ApiRequest<3, { schema: 3, userId: number, message: string | null }>
export type UnbanUserResponse = ApiResponse<3, {
  updatedPunishment: Tagged<1, PublicUserRank> | null
  channelPunishments: Tagged<1, PublicChannelPunishment>[]
}>

export type TimeoutUserRequest = ApiRequest<3, { schema: 3, userId: number, message: string | null, durationSeconds: number }>
export type TimeoutUserResponse = ApiResponse<3, {
  newPunishment: Tagged<1, PublicUserRank>
  channelPunishments: Tagged<1, PublicChannelPunishment>[]
}>

export type RevokeTimeoutRequest = ApiRequest<3, { schema: 3, userId: number, message: string | null }>
export type RevokeTimeoutResponse = ApiResponse<3, {
  updatedPunishment: Tagged<1, PublicUserRank> | null
  channelPunishments: Tagged<1, PublicChannelPunishment>[]
}>

export type MuteUserRequest = ApiRequest<2, { schema: 2, userId: number, message: string | null, durationSeconds: number | null }>
export type MuteUserResponse = ApiResponse<2, { newPunishment: Tagged<1, PublicUserRank> }>

export type UnmuteUserRequest = ApiRequest<2, { schema: 2, userId: number, message: string | null }>
export type UnmuteUserResponse = ApiResponse<2, { updatedPunishment: Tagged<1, PublicUserRank> | null }>

type Deps = ControllerDependencies<{
  rankStore: RankStore
  punishmentService: PunishmentService
  channelStore: ChannelStore
}>

@Path(buildPath('punishment'))
export default class PunishmentController extends ControllerBase {
  private readonly rankStore: RankStore
  private readonly punishmentService: PunishmentService
  private readonly channelStore: ChannelStore

  constructor (deps: Deps) {
    super(deps, 'punishment')
    this.rankStore = deps.resolve('rankStore')
    this.punishmentService = deps.resolve('punishmentService')
    this.channelStore = deps.resolve('channelStore')
  }

  @GET
  @Path('/:id')
  public async getSinglePunishment (
    @PathParam('id') id: number
  ): Promise<GetSinglePunishment> {
    const builder = this.registerResponseBuilder<GetSinglePunishment>('GET /:id', 2)
    try {
      const punishment = await this.rankStore.getUserRankById(id)
      if (punishment == null) {
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
    @QueryParam('userId') userId?: number, // if not provided, returns all
    @QueryParam('includeInactive') includeInactive?: boolean // if not set, return all
  ): Promise<GetUserPunishments> {
    const builder = this.registerResponseBuilder<GetUserPunishments>('GET', 2)
    try {
      let punishments: UserRankWithRelations[]

      if (includeInactive === true) {
        if (userId == null) {
          return builder.failure(400, 'A user ID must be provided when getting the punishment history')
        }
        punishments = await this.rankStore.getUserRankHistory(userId)

      } else {
        punishments = await this.punishmentService.getCurrentPunishments()
        if (userId != null) {
          punishments = punishments.filter(p => p.userId === userId)
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
    const builder = this.registerResponseBuilder<BanUserResponse>('POST /ban', 3)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.banUser(request.userId, request.message)
      return builder.success({
        newPunishment: userRankToPublicObject(result.punishment),
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/unban')
  public async unbanUser (request: UnbanUserRequest): Promise<UnbanUserResponse> {
    const builder = this.registerResponseBuilder<UnbanUserResponse>('POST /unban', 3)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.unbanUser(request.userId, request.message)
      return builder.success({
        updatedPunishment: result.punishment ? userRankToPublicObject(result.punishment) : null,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
  
  @POST
  @Path('/timeout')
  public async timeoutUser (request: TimeoutUserRequest): Promise<TimeoutUserResponse> {
    const builder = this.registerResponseBuilder<TimeoutUserResponse>('POST /timeout', 3)
    const minDuration = YOUTUBE_TIMEOUT_DURATION / 1000
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    } else if (request.durationSeconds == null || request.durationSeconds < minDuration) {
      return builder.failure(400, `Duration must be at least ${minDuration} seconds.`)
    }

    try {
      const result = await this.punishmentService.timeoutUser(request.userId, request.message, request.durationSeconds)
      return builder.success({
        newPunishment: userRankToPublicObject(result.punishment),
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/revokeTimeout')
  public async revokeTimeout (request: RevokeTimeoutRequest): Promise<RevokeTimeoutResponse> {
    const builder = this.registerResponseBuilder<RevokeTimeoutResponse>('POST /revokeTimeout', 3)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.untimeoutUser(request.userId, request.message)
      return builder.success({
        updatedPunishment: result.punishment ? userRankToPublicObject(result.punishment) : null,
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
      const result = await this.punishmentService.muteUser(request.userId, request.message, duration)
      return builder.success({ newPunishment: userRankToPublicObject(result) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/unmute')
  public async unmuteUser (request: UnmuteUserRequest): Promise<UnmuteUserResponse> {
    const builder = this.registerResponseBuilder<UnmuteUserResponse>('POST /unmute', 2)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.unmuteUser(request.userId, request.message)
      return builder.success({ updatedPunishment: result ? userRankToPublicObject(result) : null })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  private async getChannelPunishments (results: { youtubeResults: YoutubePunishmentResult[], twitchResults: TwitchPunishmentResult[] }): Promise<PublicChannelPunishment[]> {
    const makePublicResult = async (channelId: number, platform: 'youtube' | 'twitch', error: string | null): Promise<PublicChannelPunishment> => {
      let channelName: string
      if (platform === 'youtube') {
        channelName = await this.channelStore.getYoutubeChannelNameFromChannelId(channelId)
      } else if (platform === 'twitch') {
        channelName = await this.channelStore.getTwitchUserNameFromChannelId(channelId)
      } else {
        assertUnreachable(platform)
      }
      
      return {
        schema: 1,
        channelId,
        platform,
        error,
        channelName
      }
    }
    
    return await Promise.all([
      ...results.youtubeResults.map(c => makePublicResult(c.youtubeChannelId, 'youtube', c.error)),
      ...results.twitchResults.map(c => makePublicResult(c.twitchChannelId, 'twitch', c.error))
    ])
  }
}
