import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { userNamesAndLevelToPublicUserNames } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import { zip } from '@rebel/server/util/arrays'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { Path, POST } from 'typescript-rest'

type SearchUserRequest = ApiRequest<2, {
  schema: 2,
  searchTerm: string
}>

type SearchUserResponse = ApiResponse<2, {
  results: Tagged<1, PublicUserNames>[]
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
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search', 2)
    if (request == null || request.schema !== builder.schema || isNullOrEmpty(request.searchTerm)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const matches = await this.channelService.getUserByChannelName(request.searchTerm)
      const levels = await Promise.all(matches.map(m => this.experienceService.getLevel(m.userId)))
      const users = zip(matches, levels).map(u => userNamesAndLevelToPublicUserNames(u))

      return builder.success({ results: users })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
