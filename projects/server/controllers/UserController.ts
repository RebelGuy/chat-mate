import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { userAndLevelToPublicUser } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import { unique, zip } from '@rebel/server/util/arrays'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { Path, POST } from 'typescript-rest'

type SearchUserRequest = ApiRequest<1, {
  schema: 1,
  searchTerm: string
}>

type SearchUserResponse = ApiResponse<1, {
  results: PublicUser[]
}>

type Deps = ControllerDependencies<{
  channelService: ChannelService,
  experienceService: ExperienceService
}>

@Path(buildPath('user'))
export default class UserController extends ControllerBase {
  readonly channelService: ChannelService
  readonly experienceService: ExperienceService

  constructor (deps: Deps) {
    super(deps, 'user')
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
  }

  @POST
  @Path('search')
  public async search (request: SearchUserRequest): Promise<SearchUserResponse> {
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search', 1)
    if (request == null || request.schema !== builder.schema || isNullOrEmpty(request.searchTerm)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const matches = await this.channelService.getChannelByName(request.searchTerm)
      const levels = await Promise.all(matches.map(m => this.experienceService.getLevel(m.id)))
      const users = zip(matches, levels).map(u => userAndLevelToPublicUser(u))

      return builder.success({ results: users })
    } catch (e: any) {
      return builder.failure(e.message)
    }
  }
}
