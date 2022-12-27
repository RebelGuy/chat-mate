import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicLinkToken } from '@rebel/server/controllers/public/user/PublicLinkToken'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { userDataToPublicUserNames } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LinkDataService from '@rebel/server/services/LinkDataService'
import LinkService from '@rebel/server/services/LinkService'
import ChannelStore, {  } from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import RankStore from '@rebel/server/stores/RankStore'
import { EmptyObject } from '@rebel/server/types'
import { single, zipOnStrictMany } from '@rebel/server/util/arrays'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { DELETE, GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'

type SearchUserRequest = ApiRequest<4, {
  schema: 4,
  searchTerm: string
}>

type SearchUserResponse = ApiResponse<4, {
  results: Tagged<3, PublicUserNames>[]
}>

type GetLinkTokensResponse = ApiResponse<1, {
  tokens: PublicLinkToken[]
}>

type CreateLinkTokenResponse = ApiResponse<1, EmptyObject>

type DeleteLinkTokenResponse = ApiResponse<1, EmptyObject>

type Deps = ControllerDependencies<{
  channelService: ChannelService,
  channelStore: ChannelStore
  experienceService: ExperienceService
  rankStore: RankStore
  linkDataService: LinkDataService
}>

@Path(buildPath('user'))
export default class UserController extends ControllerBase {
  readonly channelService: ChannelService
  readonly channelStore: ChannelStore
  readonly experienceService: ExperienceService
  readonly rankStore: RankStore
  readonly linkDataService: LinkDataService

  constructor (deps: Deps) {
    super(deps, 'user')
    this.channelService = deps.resolve('channelService')
    this.channelStore = deps.resolve('channelStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.linkDataService = deps.resolve('linkDataService')
  }

  @POST
  @Path('search')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async search (request: SearchUserRequest): Promise<SearchUserResponse> {
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search', 4)
    if (request == null || request.schema !== builder.schema || isNullOrEmpty(request.searchTerm)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const matches = await this.channelService.getUserByChannelName(request.searchTerm)
      const userChannels = await this.channelService.getActiveUserChannels(this.getStreamerId(), matches.map(m => m.userId))
      const levels = await this.experienceService.getLevels(this.getStreamerId(), matches.map(m => m.userId))
      const ranks = await this.rankStore.getUserRanks(matches.map(m => m.userId), this.getStreamerId())
      const userData = zipOnStrictMany(matches, 'userId', userChannels, levels, ranks).map(userDataToPublicUserNames)

      return builder.success({ results: userData })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('link/token')
  @PreProcessor(requireAuth)
  public async getLinkTokens (): Promise<GetLinkTokensResponse> {
    const builder = this.registerResponseBuilder<GetLinkTokensResponse>('GET /link/token', 1)

    try {
      const history = await this.linkDataService.getLinkHistory(this.getCurrentUser().aggregateChatUserId)
      const channels = await Promise.all(history.map(h => this.channelStore.getDefaultUserOwnedChannels(h.defaultUserId)))
      const youtubeNames = await Promise.all(channels.flatMap(c => c.youtubeChannels).map(id => this.channelStore.getYoutubeChannelNameFromChannelId(id).then(name => ({ id, name }))))
      const twitchNames = await Promise.all(channels.flatMap(c => c.twitchChannels).map(id => this.channelStore.getTwitchUserNameFromChannelId(id).then(name => ({ id, name }))))

      return builder.success({
        tokens: history.map<PublicLinkToken>(h => {
          const channel = channels.find(c => c.userId === h.defaultUserId)!
          if (channel.youtubeChannels.length + channel.twitchChannels.length !== 1) {
            throw new Error(`Only a single channel is supported for default user ${channel.userId}`)
          }

          const platform = channel.youtubeChannels.length === 1 ? 'youtube' : 'twitch'
          const userName = platform === 'youtube' ? youtubeNames.find(y => y.id === single(channel.youtubeChannels))! : twitchNames.find(t => t.id === single(channel.twitchChannels))!

          if (h.type === 'pending' || h.type ===  'running') {
            return {
              schema: 1,
              status: h.type === 'pending' ? 'waiting' : 'processing',
              token: h.maybeToken,
              channelUserName: userName.name,
              platform: platform
            }
          } else if (h.type === 'success' || h.type === 'fail') {
            return {
              schema: 1,
              status: h.type === 'success' ? 'succeeded' : 'failed',
              token: h.token,
              channelUserName: userName.name,
              platform: platform
            }
          } else {
            assertUnreachable(h.type)
          }
        })
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('link/token')
  @PreProcessor(requireAuth)
  public async createLinkToken (externalId: string): Promise<CreateLinkTokenResponse> {
    const builder = this.registerResponseBuilder<DeleteLinkTokenResponse>('DELETE /link/token', 1)

    try {
      await this.linkDataService.getOrCreateLinkToken(this.getCurrentUser().aggregateChatUserId, externalId)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
