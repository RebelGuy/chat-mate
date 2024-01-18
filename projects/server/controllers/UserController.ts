import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicLinkHistoryItem } from '@rebel/api-models/public/user/PublicLinkHistoryItem'
import { PublicUserSearchResult } from '@rebel/api-models/public/user/PublicUserSearchResult'
import { channelToPublicChannel, registeredUserToPublic, userDataToPublicUser } from '@rebel/server/models/user'
import ChannelService, { getExternalIdOrUserName, getUserName } from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LinkDataService from '@rebel/server/services/LinkDataService'
import LinkService, { UnlinkUserOptions } from '@rebel/server/services/LinkService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore, {  } from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import RankStore from '@rebel/server/stores/RankStore'
import { intersection, nonNull, single, symmetricDifference, unique } from '@rebel/shared/util/arrays'
import { ChatMessageForStreamerNotFoundError, LinkAttemptInProgressError, NotFoundError, UserAlreadyLinkedToAggregateUserError } from '@rebel/shared/util/error'
import { asGte, asLte } from '@rebel/shared/util/math'
import { sleep } from '@rebel/shared/util/node'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { DELETE, GET, Path, PathParam, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { AddLinkedChannelResponse, CreateLinkTokenResponse, DeleteLinkTokenResponse, GetLinkedChannelsResponse, GetLinkHistoryResponse, GetUserResponse, RemoveLinkedChannelResponse, SearchUserRequest, SearchUserResponse } from '@rebel/api-models/schema/user'

type Deps = ControllerDependencies<{
  channelService: ChannelService,
  channelStore: ChannelStore
  experienceService: ExperienceService
  rankStore: RankStore
  linkDataService: LinkDataService
  accountStore: AccountStore
  linkService: LinkService
  linkStore: LinkStore
}>

@Path(buildPath('user'))
export default class UserController extends ControllerBase {
  private readonly channelService: ChannelService
  private readonly channelStore: ChannelStore
  private readonly experienceService: ExperienceService
  private readonly rankStore: RankStore
  private readonly linkDataService: LinkDataService
  private readonly accountStore: AccountStore
  private readonly linkService: LinkService
  private readonly linkStore: LinkStore

  constructor (deps: Deps) {
    super(deps, 'user')
    this.channelService = deps.resolve('channelService')
    this.channelStore = deps.resolve('channelStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.linkDataService = deps.resolve('linkDataService')
    this.accountStore = deps.resolve('accountStore')
    this.linkService = deps.resolve('linkService')
    this.linkStore = deps.resolve('linkStore')
  }

  @GET
  @Path('/')
  @PreProcessor(requireAuth)
  public async getUser (): Promise<GetUserResponse> {
    const builder = this.registerResponseBuilder<GetUserResponse>('GET /')

    try {
      const allData = await this.apiService.getAllData([this.getCurrentUser().aggregateChatUserId]).then(single)
      return builder.success({ user: userDataToPublicUser(allData) })
    } catch (e: any) {
      if (e instanceof ChatMessageForStreamerNotFoundError) {
        return builder.failure(404, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  @POST
  @Path('search')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async search (request: SearchUserRequest): Promise<SearchUserResponse> {
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search')
    if (request == null || isNullOrEmpty(request.searchTerm)) {
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
          user: userDataToPublicUser(data),
          matchedChannel: channelToPublicChannel(match),
          allChannels: channels.channels.map(channelToPublicChannel)
        }
      })

      return builder.success({ results })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('search/registered')
  @PreProcessor(requireStreamer) // streamer is required to get channel data
  @PreProcessor(requireRank('admin'))
  public async searchRegisteredUsers (request: SearchUserRequest): Promise<SearchUserResponse> {
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search')
    if (request == null || isNullOrEmpty(request.searchTerm)) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const matches = await this.accountStore.searchByUserName(request.searchTerm)
      const aggregateUserIds = matches.map(c => c.aggregateChatUserId)

      const userChannels = await this.channelService.getConnectedUserChannels(aggregateUserIds)

      // not all aggregate users will have channels attached to them (or channels that are active for the current streamer)
      const streamerChannels = await this.channelStore.getAllChannels(this.getStreamerId())
      const aggregateUserIdsWithChannels = nonNull(intersection(aggregateUserIds, streamerChannels.map(c => c.aggregateUserId)))

      const aggregateUserIdsWithoutChannels = symmetricDifference(aggregateUserIds, aggregateUserIdsWithChannels)
      const standaloneRegisteredUsers = await this.accountStore.getRegisteredUsers(aggregateUserIdsWithoutChannels)

      const allData = await this.apiService.getAllData(aggregateUserIdsWithChannels)
      const results = matches.map<PublicUserSearchResult>(match => {
        const aggregateUserId = match.aggregateChatUserId
        const channels = userChannels.find(c => c.userId === aggregateUserId)! // userChannels were requested via the aggregate user
        const data = allData.find(d => d.primaryUserId === aggregateUserId)

        return {
          user: userDataToPublicUser(data ?? {
            aggregateUserId,
            primaryUserId: aggregateUserId,
            defaultUserId: channels.channels[0]?.defaultUserId ?? -1,
            level: { level: 0, levelProgress: asLte(asGte(0, 0), 1), totalExperience: 0 },
            ranks: [],
            platformInfo: channels.channels[0]?.platformInfo ?? {
              platform: 'youtube',
              channel: {
                id: -1,
                youtubeId: '',
                userId: -1,
                infoHistory: [{
                  channelId: -1,
                  id: -1,
                  imageUrl: '',
                  isModerator: false,
                  isOwner: false,
                  isVerified: false,
                  name: 'n/a',
                  time: new Date()
                }]
              }},
            registeredUser: standaloneRegisteredUsers.find(r => r.queriedUserId === aggregateUserId)!.registeredUser,
            firstSeen: 0,
            customRankNames: {}
          }),
          matchedChannel: null,
          allChannels: channels.channels.map(channelToPublicChannel)
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
    const builder = this.registerResponseBuilder<GetLinkedChannelsResponse>('GET /link/channels')

    if (!this.hasRankOrAbove('admin') && admin_aggregateUserId != null) {
      builder.failure(403, 'You do not have permission to use the `admin_aggregateUserId` query parameter.')
    }

    try {
      const channels = await this.channelService.getConnectedUserChannels([admin_aggregateUserId ?? this.getCurrentUser().aggregateChatUserId]).then(single)
      const registeredUser = await this.accountStore.getRegisteredUsers([admin_aggregateUserId ?? this.getCurrentUser().aggregateChatUserId]).then(single)

      if (registeredUser == null) {
        throw new Error('Expected registered user for aggregate user to be defined.')
      }

      return builder.success({
        registeredUser: registeredUserToPublic(registeredUser.registeredUser)!,
        channels: channels.channels.map(channelToPublicChannel)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('link/channels/:aggregateUserId/:defaultUserId')
  @PreProcessor(requireRank('admin'))
  public async addLinkedChannel (
    @PathParam('aggregateUserId') aggregateUserId: number,
    @PathParam('defaultUserId') defaultUserId: number
  ): Promise<AddLinkedChannelResponse> {
    const builder = this.registerResponseBuilder<AddLinkedChannelResponse>('POST /link/channels/:aggregateUserId/:defaultUserId')

    if (aggregateUserId == null || defaultUserId == null) {
      return builder.failure(400, 'An aggregate and default user id must be provided.')
    }

    try {
      const registeredUser = await this.accountStore.getRegisteredUserFromAggregateUser(aggregateUserId)
      if (registeredUser == null) {
        return builder.failure(400, `User ${aggregateUserId} is not an aggregate user.`)
      }

      await retryLinkAttempt(() => this.linkService.linkUser(defaultUserId, aggregateUserId, null))
      return builder.success({})
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
    const builder = this.registerResponseBuilder<RemoveLinkedChannelResponse>('DELETE /link/channels/:defaultUserId')

    if (defaultUserId == null) {
      return builder.failure(400, 'Default user id must be provided.')
    }

    try {
      const options: UnlinkUserOptions = {
        transferRanks: transferRanks ?? true,
        relinkChatExperience: relinkChatExperience ?? true,
        relinkDonations: relinkDonations ?? true
      }
      await retryLinkAttempt(() => this.linkService.unlinkUser(defaultUserId, options))
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('link/history')
  @PreProcessor(requireAuth)
  public async getLinkHistory (
    @QueryParam('admin_aggregateUserId') admin_aggregateUserId?: number
  ): Promise<GetLinkHistoryResponse> {
    const builder = this.registerResponseBuilder<GetLinkHistoryResponse>('GET /link/token')

    if (!this.hasRankOrAbove('admin') && admin_aggregateUserId != null) {
      builder.failure(403, 'You do not have permission to use the `admin_aggregateUserId` query parameter.')
    }

    try {
      const history = await this.linkDataService.getLinkHistory(admin_aggregateUserId ?? this.getCurrentUser().aggregateChatUserId)
      const defaultUserIds = history.map(h => h.defaultUserId)
      const channels = await this.channelStore.getDefaultUserOwnedChannels(defaultUserIds)
      const youtubeChannels = await this.channelStore.getYoutubeChannelsFromChannelIds(channels.flatMap(c => c.youtubeChannelIds))
      const twitchChannels = await this.channelStore.getTwitchChannelsFromChannelIds(channels.flatMap(c => c.twitchChannelIds))

      return builder.success({
        items: history.map<PublicLinkHistoryItem>(h => {
          const userOwnedChannels = channels.find(c => c.userId === h.defaultUserId)!
          if (userOwnedChannels.youtubeChannelIds.length + userOwnedChannels.twitchChannelIds.length !== 1) {
            throw new Error(`Only a single channel is supported for default user ${userOwnedChannels.userId}`)
          }

          const platform = userOwnedChannels.youtubeChannelIds.length === 1 ? 'youtube' : 'twitch'
          const channel = platform === 'youtube' ? youtubeChannels.find(y => y.platformInfo.channel.id === single(userOwnedChannels.youtubeChannelIds))! : twitchChannels.find(t => t.platformInfo.channel.id === single(userOwnedChannels.twitchChannelIds))!

          if (h.type === 'pending' || h.type ===  'running') {
            return {
              status: h.type === 'pending' ? 'pending' : 'processing',
              token: h.maybeToken,
              externalIdOrUserName: getExternalIdOrUserName(channel),
              displayName: getUserName(channel),
              platform: platform,
              message: null,
              dateCompleted: null,
              type: h.isLink ? 'link' : 'unlink'
            }
          } else if (h.type === 'success' || h.type === 'fail') {
            return {
              status: h.type === 'success' ? 'succeeded' : 'failed',
              token: h.token,
              externalIdOrUserName: getExternalIdOrUserName(channel),
              displayName: getUserName(channel),
              platform: platform,
              message: h.message,
              dateCompleted: h.completionTime.getTime(),
              type: h.isLink ? 'link' : 'unlink'
            }
          } else if (h.type === 'waiting') {
            return {
              status: 'waiting',
              token: h.token,
              externalIdOrUserName: getExternalIdOrUserName(channel),
              displayName: getUserName(channel),
              platform: platform,
              message: null,
              dateCompleted: null,
              type: h.isLink ? 'link' : 'unlink'
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
    const builder = this.registerResponseBuilder<CreateLinkTokenResponse>('POST /link/token')

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

  @DELETE
  @Path('link/token')
  @PreProcessor(requireAuth)
  public async deleteLinkToken (
    @QueryParam('linkToken') linkToken: string
  ): Promise<DeleteLinkTokenResponse> {
    const builder = this.registerResponseBuilder<DeleteLinkTokenResponse>('DELETE /link/token')

    if (isNullOrEmpty(linkToken)) {
      return builder.failure(400, 'linkToken must be provided')
    }

    try {
      const success = await this.linkStore.deleteLinkToken(this.getCurrentUser().aggregateChatUserId, linkToken)
      if (!success) {
        return builder.failure(404, `Could not delete the link token because it doesn't exist`)
      } else {
        return builder.success({})
      }
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}

async function retryLinkAttempt (linkAttempt: () => Promise<void>) {
  const attempts = 5

  for (let i = 0; i < attempts; i++) {
    try {
      await linkAttempt()
      return
    } catch (e) {
      if (e instanceof LinkAttemptInProgressError && i < attempts - 1) {
        await sleep(2000)
        continue
      } else {
        throw e
      }
    }
  }
}
