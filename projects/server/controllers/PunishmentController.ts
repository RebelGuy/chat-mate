import { Punishment } from '@prisma/client'
import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'
import { isPunishmentActive, punishmentToPublicObject } from '@rebel/server/models/punishment'
import PunishmentService from '@rebel/server/services/PunishmentService'
import PunishmentStore from '@rebel/server/stores/PunishmentStore'
import { sortBy } from '@rebel/server/util/arrays'
import { Path, GET, QueryParam, POST, PathParam } from 'typescript-rest'
import { YOUTUBE_TIMEOUT_DURATION } from '@rebel/server/services/YoutubeTimeoutRefreshService'

export type GetSinglePunishment = ApiResponse<1, { punishment: Tagged<1, PublicPunishment> }>

export type GetUserPunishments = ApiResponse<1, { punishments: Tagged<1, PublicPunishment>[] }>

export type BanUserRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null }>
export type BanUserResponse = ApiResponse<1, { newPunishment: Tagged<1, PublicPunishment> }>

export type UnbanUserRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null }>
export type UnbanUserResponse = ApiResponse<1, { updatedPunishment: Tagged<1, PublicPunishment> | null }>

export type TimeoutUserRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null, durationSeconds: number }>
export type TimeoutUserResponse = ApiResponse<1, { newPunishment: Tagged<1, PublicPunishment> }>

export type RevokeTimeoutRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null }>
export type RevokeTimeoutResponse = ApiResponse<1, { updatedPunishment: Tagged<1, PublicPunishment> | null }>

export type MuteUserRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null, durationSeconds: number | null }>
export type MuteUserResponse = ApiResponse<1, { newPunishment: Tagged<1, PublicPunishment> }>

export type UnmuteUserRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null }>
export type UnmuteUserResponse = ApiResponse<1, { updatedPunishment: Tagged<1, PublicPunishment> | null }>

type Deps = ControllerDependencies<{
  punishmentStore: PunishmentStore
  punishmentService: PunishmentService
}>

@Path(buildPath('punishment'))
export default class PunishmentController extends ControllerBase {
  private readonly punishmentStore: PunishmentStore
  private readonly punishmentService: PunishmentService

  constructor (deps: Deps) {
    super(deps, 'punishment')
    this.punishmentStore = deps.resolve('punishmentStore')
    this.punishmentService = deps.resolve('punishmentService')
  }

  @GET
  @Path('/:id')
  public async getSinglePunishment (
    @PathParam('id') id: number
  ): Promise<GetSinglePunishment> {
    const builder = this.registerResponseBuilder<GetSinglePunishment>('GET /:id', 1)
    try {
      const punishment = (await this.punishmentStore.getPunishments()).find(p => p.id === id)
      if (punishment == null) {
        return builder.failure(404, `Cannot find punishment with id ${id}.`)
      } else {
        return builder.success({ punishment: punishmentToPublicObject(punishment) })
      }
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  public async getPunishments (
    @QueryParam('userId') userId?: number, // if not provided, returns all
    @QueryParam('activeOnly') activeOnly?: boolean // if not set, return all
  ): Promise<GetUserPunishments> {
    const builder = this.registerResponseBuilder<GetUserPunishments>('GET', 1)
    try {
      let punishments: Punishment[]
      if (userId != null) {
        punishments = await this.punishmentStore.getPunishmentsForUser(userId)
      } else {
        punishments = await this.punishmentStore.getPunishments()
      }
      
      if (activeOnly === true) {
        punishments = punishments.filter(isPunishmentActive)
      }

      punishments = sortBy(punishments, p => p.issuedAt.getTime(), 'desc')
      return builder.success({ punishments: punishments.map(e => punishmentToPublicObject(e)) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/ban')
  public async banUser (request: BanUserRequest): Promise<BanUserResponse> {
    const builder = this.registerResponseBuilder<BanUserResponse>('POST /ban', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.banUser(request.userId, request.message)
      return builder.success({ newPunishment: punishmentToPublicObject(result) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/unban')
  public async unbanUser (request: UnbanUserRequest): Promise<UnbanUserResponse> {
    const builder = this.registerResponseBuilder<UnbanUserResponse>('POST /unban', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.unbanUser(request.userId, request.message)
      return builder.success({ updatedPunishment: result ? punishmentToPublicObject(result) : null })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
  
  @POST
  @Path('/timeout')
  public async timeoutUser (request: TimeoutUserRequest): Promise<TimeoutUserResponse> {
    const builder = this.registerResponseBuilder<TimeoutUserResponse>('POST /timeout', 1)
    const minDuration = YOUTUBE_TIMEOUT_DURATION / 1000
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    } else if (request.durationSeconds == null || request.durationSeconds < minDuration) {
      return builder.failure(400, `Duration must be at least ${minDuration} seconds.`)
    }

    try {
      const result = await this.punishmentService.timeoutUser(request.userId, request.message, request.durationSeconds)
      return builder.success({ newPunishment: punishmentToPublicObject(result) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/revokeTimeout')
  public async revokeTimeout (request: RevokeTimeoutRequest): Promise<RevokeTimeoutResponse> {
    const builder = this.registerResponseBuilder<RevokeTimeoutResponse>('POST /revokeTimeout', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.untimeoutUser(request.userId, request.message)
      return builder.success({ updatedPunishment: result ? punishmentToPublicObject(result) : null })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/mute')
  public async muteUser (request: MuteUserRequest): Promise<MuteUserResponse> {
    const builder = this.registerResponseBuilder<MuteUserResponse>('POST /mute', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null || (request.durationSeconds != null && request.durationSeconds < 0)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const duration = request.durationSeconds == null || request.durationSeconds === 0 ? null : request.durationSeconds
      const result = await this.punishmentService.muteUser(request.userId, request.message, duration)
      return builder.success({ newPunishment: punishmentToPublicObject(result) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/unmute')
  public async unmuteUser (request: UnmuteUserRequest): Promise<UnmuteUserResponse> {
    const builder = this.registerResponseBuilder<UnmuteUserResponse>('POST /unmute', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.punishmentService.unmuteUser(request.userId, request.message)
      return builder.success({ updatedPunishment: result ? punishmentToPublicObject(result) : null })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
