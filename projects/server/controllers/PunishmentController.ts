import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'
import { punishmentToPublicObject } from '@rebel/server/models/punishment'
import PunishmentService from '@rebel/server/services/PunishmentService'
import PunishmentStore from '@rebel/server/stores/PunishmentStore'
import { sortBy } from '@rebel/server/util/arrays'
import { Path, GET, QueryParam, POST } from 'typescript-rest'

export type GetUserPunishments = ApiResponse<1, { punishments: Tagged<1, PublicPunishment>[] }>

export type BanUserRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null }>
export type BanUserResponse = ApiResponse<1, { newPunishment: Tagged<1, PublicPunishment> }>

export type UnbanUserRequest = ApiRequest<1, { schema: 1, userId: number, message: string | null }>
export type UnbanUserResponse = ApiResponse<1, { updatedPunishment: Tagged<1, PublicPunishment> | null }>

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
  public async getCustomEmojis (
    @QueryParam('userId') userId: number
  ): Promise<GetUserPunishments> {
    const builder = this.registerResponseBuilder<GetUserPunishments>('GET', 1)
    if (userId == null) {
      return builder.failure(400, 'userId was not provided.')
    }

    try {
      let punishments = await this.punishmentStore.getPunishmentsForUser(userId)
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
}
