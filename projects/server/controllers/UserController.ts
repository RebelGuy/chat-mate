import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'
import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { PublicLinkToken } from '@rebel/server/controllers/public/user/PublicLinkToken'
import { PublicUserSearchResult } from '@rebel/server/controllers/public/user/PublicUserSearchResult'
import { userDataToPublicUser } from '@rebel/server/models/user'
import AccountService, { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ChannelService, { getExternalIdOrUserName, getUserName, getUserNameFromChannelInfo } from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LinkDataService from '@rebel/server/services/LinkDataService'
import LinkService, { UnlinkUserOptions } from '@rebel/server/services/LinkService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore, {  } from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import RankStore from '@rebel/server/stores/RankStore'
import { EmptyObject } from '@rebel/server/types'
import { single, unique, zipOnStrictMany } from '@rebel/server/util/arrays'
import { NotFoundError, UserAlreadyLinkedToAggregateUserError } from '@rebel/server/util/error'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { DELETE, GET, Path, PathParam, POST, PreProcessor, QueryParam } from 'typescript-rest'

export type SearchUserRequest = ApiRequest<4, {
  schema: 4,
  searchTerm: string
}>

export type SearchUserResponse = ApiResponse<4, {
  results: Tagged<1, PublicUserSearchResult>[]
}>

export type GetLinkedChannelsResponse = ApiResponse<1, {
  channels: PublicChannelInfo[]
}>

export type RemoveLinkedChannelResponse = ApiResponse<1, EmptyObject>

export type GetLinkTokensResponse = ApiResponse<1, {
  tokens: PublicLinkToken[]
}>

export type CreateLinkTokenResponse = ApiResponse<1, {
  token: string
}>

type Deps = ControllerDependencies<{
  channelService: ChannelService,
  channelStore: ChannelStore
  experienceService: ExperienceService
  rankStore: RankStore
  linkDataService: LinkDataService
  accountStore: AccountStore
  linkService: LinkService
}>

@Path(buildPath('user'))
export default class UserController extends ControllerBase {
  readonly channelService: ChannelService
  readonly channelStore: ChannelStore
  readonly experienceService: ExperienceService
  readonly rankStore: RankStore
  readonly linkDataService: LinkDataService
  readonly accountStore: AccountStore
  readonly linkService: LinkService

  constructor (deps: Deps) {
    super(deps, 'user')
    this.channelService = deps.resolve('channelService')
    this.channelStore = deps.resolve('channelStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.linkDataService = deps.resolve('linkDataService')
    this.accountStore = deps.resolve('accountStore')
    this.linkService = deps.resolve('linkService')
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
      const matches = await this.channelService.searchChannelsByName(this.getStreamerId(), request.searchTerm)
      const defaultUserIds = unique(matches.map(m => m.defaultUserId))
      const userChannels = await this.channelService.getConnectedUserChannels(defaultUserIds)

      const primaryUserIds = userChannels.map(c => c.aggregateUserId ?? c.userId)

      const allData = await this.apiService.getAllData(primaryUserIds)
      const results = matches.map<PublicUserSearchResult>(match => {
        const defaultUserId = match.defaultUserId
        const channels = userChannels.find(c => c.userId === defaultUserId)! // userChannels were requested with the matches' default users
        const primaryUserId = channels.aggregateUserId ?? defaultUserId
        const data = allData.find(d => d.primaryUserId === primaryUserId)!

        return {
          schema: 1,
          user: userDataToPublicUser(data),
          matchedChannel: {
            schema: 1,
            channelId: match.platformInfo.channel.id,
            platform: match.platformInfo.platform,
            displayName: getUserName(match)
          },
          allChannels: channels.channels.map(c => ({
            schema: 1,
            channelId: c.platformInfo.channel.id,
            platform: c.platformInfo.platform,
            displayName: getUserName(c)
          }))
        }
      })

      return builder.success({ results })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('link/channels')
  @PreProcessor(requireAuth)
  public async getLinkedChannels (
    @QueryParam('admin_aggregateUserId') admin_aggregateUserId?: number
  ): Promise<GetLinkedChannelsResponse> {
    const builder = this.registerResponseBuilder<GetLinkedChannelsResponse>('GET /link/channels', 1)

    if (!this.hasRankOrAbove('admin') && admin_aggregateUserId != null) {
      builder.failure(403, 'You do not have permission to use the `admin_aggregateUserId` query parameter.')
    }

    try {
      const channels = single(await this.channelService.getConnectedUserChannels([admin_aggregateUserId ?? this.getCurrentUser().aggregateChatUserId]))
      return builder.success({
        channels: channels.channels.map<PublicChannelInfo>(channel => ({
          schema: 1,
          defaultUserId: channel.defaultUserId,
          externalIdOrUserName: getExternalIdOrUserName(channel),
          platform: channel.platformInfo.platform,
          channelName: getUserName(channel)
        }))
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @DELETE
  @Path('link/channels/:defaultUserId')
  @PreProcessor(requireRank('admin'))
  public async removeLinkedChannel (
    @PathParam('defaultUserId') defaultUserId: number,
    @QueryParam('transferRanks') transferRanks?: boolean,
    @QueryParam('relinkChatExperience') relinkChatExperience?: boolean,
    @QueryParam('relinkDonations') relinkDonations?: boolean
  ): Promise<RemoveLinkedChannelResponse> {
    const builder = this.registerResponseBuilder<RemoveLinkedChannelResponse>('DELETE /link/channels/:defaultUserId', 1)

    if (defaultUserId == null) {
      return builder.failure(400, 'Default user id must be provided.')
    }

    try {
      const options: UnlinkUserOptions = {
        transferRanks: transferRanks ?? true,
        relinkChatExperience: relinkChatExperience ?? true,
        relinkDonations: relinkDonations ?? true
      }
      await this.linkService.unlinkUser(defaultUserId, options)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('link/token')
  @PreProcessor(requireAuth)
  public async getLinkTokens (
    @QueryParam('admin_aggregateUserId') admin_aggregateUserId?: number
  ): Promise<GetLinkTokensResponse> {
    const builder = this.registerResponseBuilder<GetLinkTokensResponse>('GET /link/token', 1)

    if (!this.hasRankOrAbove('admin') && admin_aggregateUserId != null) {
      builder.failure(403, 'You do not have permission to use the `admin_aggregateUserId` query parameter.')
    }

    try {
      const history = await this.linkDataService.getLinkHistory(admin_aggregateUserId ?? this.getCurrentUser().aggregateChatUserId)
      const defaultUserIds = history.map(h => h.defaultUserId)
      const channels = await this.channelStore.getDefaultUserOwnedChannels(defaultUserIds)
      const youtubeChannels = await this.channelStore.getYoutubeChannelFromChannelId(channels.flatMap(c => c.youtubeChannelIds))
      const twitchChannels = await this.channelStore.getTwitchChannelFromChannelId(channels.flatMap(c => c.twitchChannelIds))

      return builder.success({
        tokens: history.map<PublicLinkToken>(h => {
          const userOwnedChannels = channels.find(c => c.userId === h.defaultUserId)!
          if (userOwnedChannels.youtubeChannelIds.length + userOwnedChannels.twitchChannelIds.length !== 1) {
            throw new Error(`Only a single channel is supported for default user ${userOwnedChannels.userId}`)
          }

          const platform = userOwnedChannels.youtubeChannelIds.length === 1 ? 'youtube' : 'twitch'
          const channel = platform === 'youtube' ? youtubeChannels.find(y => y.platformInfo.channel.id === single(userOwnedChannels.youtubeChannelIds))! : twitchChannels.find(t => t.platformInfo.channel.id === single(userOwnedChannels.twitchChannelIds))!

          if (h.type === 'pending' || h.type ===  'running') {
            return {
              schema: 1,
              status: h.type === 'pending' ? 'pending' : 'processing',
              token: h.maybeToken,
              channelUserName: getUserName(channel),
              platform: platform,
              message: null
            }
          } else if (h.type === 'success' || h.type === 'fail') {
            return {
              schema: 1,
              status: h.type === 'success' ? 'succeeded' : 'failed',
              token: h.token,
              channelUserName: getUserName(channel),
              platform: platform,
              message: h.message
            }
          } else if (h.type === 'waiting') {
            return {
              schema: 1,
              status: 'waiting',
              token: h.token,
              channelUserName: getUserName(channel),
              platform: platform,
              message: null
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
  public async createLinkToken (
    @QueryParam('externalId') externalId: string
  ): Promise<CreateLinkTokenResponse> {
    const builder = this.registerResponseBuilder<CreateLinkTokenResponse>('POST /link/token', 1)

    if (externalId == null || externalId.length === 0) {
      return builder.failure(400, 'ExternalId must be provided')
    }

    try {
      const linkToken = await this.linkDataService.getOrCreateLinkToken(this.getCurrentUser().aggregateChatUserId, externalId)
      return builder.success({ token: linkToken.token })
    } catch (e: any) {
      if (e instanceof NotFoundError) {
        return builder.failure(404, e)
      } else if (e instanceof UserAlreadyLinkedToAggregateUserError) {
        return builder.failure(422, e)
      } else {
        return builder.failure(e)
      }
    }
  }
}
