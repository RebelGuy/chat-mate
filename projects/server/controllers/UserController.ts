import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { punishmentToPublicObject } from '@rebel/server/models/punishment'
import { userNamesAndLevelToPublicUserNames } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import PunishmentService from '@rebel/server/services/PunishmentService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { nonNull, zip } from '@rebel/server/util/arrays'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { Path, POST } from 'typescript-rest'

type SearchUserRequest = ApiRequest<3, {
  schema: 3,
  searchTerm: string
}>

type SearchUserResponse = ApiResponse<3, {
  results: Tagged<2, PublicUserNames>[]
}>

type Deps = ControllerDependencies<{
  channelService: ChannelService,
  channelStore: ChannelStore
  experienceService: ExperienceService
  punishmentService: PunishmentService
}>

@Path(buildPath('user'))
export default class UserController extends ControllerBase {
  readonly channelService: ChannelService
  readonly channelStore: ChannelStore
  readonly experienceService: ExperienceService
  readonly punishmentService: PunishmentService

  constructor (deps: Deps) {
    super(deps, 'user')
    this.channelService = deps.resolve('channelService')
    this.channelStore = deps.resolve('channelStore')
    this.experienceService = deps.resolve('experienceService')
    this.punishmentService = deps.resolve('punishmentService')
  }

  @POST
  @Path('search')
  public async search (request: SearchUserRequest): Promise<SearchUserResponse> {
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search', 3)
    if (request == null || request.schema !== builder.schema || isNullOrEmpty(request.searchTerm)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const matches = await this.channelService.getUserByChannelName(request.searchTerm)
      const userChannels = nonNull(await Promise.all(matches.map(m => this.channelService.getActiveUserChannel(m.userId))))
      const levels = await Promise.all(matches.map(m => this.experienceService.getLevel(m.userId)))
      const punishments = await this.punishmentService.getCurrentPunishments()
      const users = zip(zip(matches, levels), userChannels).map(data => {
        const userPunishments = punishments.filter(p => p.userId === data.userId).map(punishmentToPublicObject)
        return userNamesAndLevelToPublicUserNames(data, userPunishments)
      })

      return builder.success({ results: users })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
