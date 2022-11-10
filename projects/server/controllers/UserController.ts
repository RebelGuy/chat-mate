import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { userDataToPublicUserNames } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ChannelStore, {  } from '@rebel/server/stores/ChannelStore'
import RankStore from '@rebel/server/stores/RankStore'
import { zipOnStrictMany } from '@rebel/server/util/arrays'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { Path, POST, PreProcessor } from 'typescript-rest'

type SearchUserRequest = ApiRequest<4, {
  schema: 4,
  searchTerm: string
}>

type SearchUserResponse = ApiResponse<4, {
  results: Tagged<3, PublicUserNames>[]
}>

type Deps = ControllerDependencies<{
  channelService: ChannelService,
  channelStore: ChannelStore
  experienceService: ExperienceService
  rankStore: RankStore
}>

@Path(buildPath('user'))
@PreProcessor(requireStreamer)
@PreProcessor(requireRank('owner'))
export default class UserController extends ControllerBase {
  readonly channelService: ChannelService
  readonly channelStore: ChannelStore
  readonly experienceService: ExperienceService
  readonly rankStore: RankStore

  constructor (deps: Deps) {
    super(deps, 'user')
    this.channelService = deps.resolve('channelService')
    this.channelStore = deps.resolve('channelStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
  }

  @POST
  @Path('search')
  public async search (request: SearchUserRequest): Promise<SearchUserResponse> {
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search', 4)
    if (request == null || request.schema !== builder.schema || isNullOrEmpty(request.searchTerm)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const matches = await this.channelService.getUserByChannelName(request.searchTerm)
      const userChannels = await this.channelService.getActiveUserChannels(matches.map(m => m.userId))
      const levels = await this.experienceService.getLevels(matches.map(m => m.userId))
      const ranks = await this.rankStore.getUserRanks(matches.map(m => m.userId), this.getStreamerId())
      const userData = zipOnStrictMany(matches, 'userId', userChannels, levels, ranks).map(userDataToPublicUserNames)

      return builder.success({ results: userData })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
