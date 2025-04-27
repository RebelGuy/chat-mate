import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicLinkHistoryItem } from '@rebel/api-models/public/user/PublicLinkHistoryItem'
import { PublicUserSearchResult } from '@rebel/api-models/public/user/PublicUserSearchResult'
import { channelToPublicChannel, registeredUserToPublic, userDataToPublicUser } from '@rebel/server/models/user'
import ChannelService, { getExternalIdOrUserName, getUserName } from '@rebel/server/services/ChannelService'
import LinkDataService from '@rebel/server/services/LinkDataService'
import LinkService, { UnlinkUserOptions } from '@rebel/server/services/LinkService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore, { YoutubeChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { intersection, nonNull, single, symmetricDifference, unique } from '@rebel/shared/util/arrays'
import { ChatMateError, ChatMessageForStreamerNotFoundError, LinkAttemptInProgressError, NotFoundError, UserAlreadyLinkedToAggregateUserError } from '@rebel/shared/util/error'
import { asGte, asLte } from '@rebel/shared/util/math'
import { sleep } from '@rebel/shared/util/node'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { DELETE, GET, Path, PathParam, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { AddLinkedChannelResponse, CreateLinkTokenResponse, DeleteLinkTokenResponse, GetLinkedChannelsResponse, GetLinkHistoryResponse, GetUserResponse, GetYoutubeLoginUrlResponse, RemoveLinkedChannelResponse, SearchUserRequest, SearchUserResponse, LinkYoutubeChannelResponse, GetTwitchLoginUrlResponse, LinkTwitchChannelResponse, SetDisplayNameRequest, SetDisplayNameResponse } from '@rebel/api-models/schema/user'
import { generateMaxStringLengthValidator, nonEmptyStringValidator } from '@rebel/server/controllers/validation'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'
import UserLinkService from '@rebel/server/services/UserLinkService'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import UserStore from '@rebel/server/stores/UserStore'

type Deps = ControllerDependencies<{
  channelService: ChannelService,
  channelStore: ChannelStore
  linkDataService: LinkDataService
  accountStore: AccountStore
  linkService: LinkService
  linkStore: LinkStore
  youtubeAuthProvider: YoutubeAuthProvider
  twurpleAuthProvider: TwurpleAuthProvider
  userLinkService: UserLinkService
  userStore: UserStore
}>

@Path(buildPath('user'))
export default class UserController extends ControllerBase {
  private readonly channelService: ChannelService
  private readonly channelStore: ChannelStore
  private readonly linkDataService: LinkDataService
  private readonly accountStore: AccountStore
  private readonly linkService: LinkService
  private readonly linkStore: LinkStore
  private readonly youtubeAuthProvider: YoutubeAuthProvider
  private readonly twurpleAuthProvider: TwurpleAuthProvider
  private readonly userLinkService: UserLinkService
  private readonly userStore: UserStore

  constructor (deps: Deps) {
    super(deps, 'user')
    this.channelService = deps.resolve('channelService')
    this.channelStore = deps.resolve('channelStore')
    this.linkDataService = deps.resolve('linkDataService')
    this.accountStore = deps.resolve('accountStore')
    this.linkService = deps.resolve('linkService')
    this.linkStore = deps.resolve('linkStore')
    this.youtubeAuthProvider = deps.resolve('youtubeAuthProvider')
    this.twurpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.userLinkService = deps.resolve('userLinkService')
    this.userStore = deps.resolve('userStore')
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
  @Path('/displayName')
  @PreProcessor(requireAuth)
  public async setDisplayName (request: SetDisplayNameRequest): Promise<SetDisplayNameResponse> {
    const builder = this.registerResponseBuilder<SetDisplayNameResponse>('POST /displayName')

    const validationError = builder.validateInput({
      displayName: {type: 'string', nullable: true, validators: [generateMaxStringLengthValidator(20)] }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      await this.userStore.setDisplayName(this.getCurrentUser().id, request.displayName)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('search')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async search (request: SearchUserRequest): Promise<SearchUserResponse> {
    const builder = this.registerResponseBuilder<SearchUserResponse>('POST /search')

    const validationError = builder.validateInput({ searchTerm: { type: 'string', validators: [nonEmptyStringValidator] }}, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const matches = await this.channelService.searchChannelsByName(this.getStreamerId(), request.searchTerm, false)
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

    const validationError = builder.validateInput({ searchTerm: { type: 'string', validators: [nonEmptyStringValidator] }}, request)
    if (validationError != null) {
      return validationError
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
                globalInfoHistory: [{
                  channelId: -1,
                  id: -1,
                  imageUrl: '',
                  isVerified: false,
                  name: 'n/a',
                  time: new Date()
                }]
              } as YoutubeChannelWithLatestInfo
            },
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

    const validationError = builder.validateInput({ admin_aggregateUserId: { type: 'number', optional: true }}, { admin_aggregateUserId })
    if (validationError != null) {
      return validationError
    }

    try {
      const channels = await this.channelService.getConnectedUserChannels([admin_aggregateUserId ?? this.getCurrentUser().aggregateChatUserId]).then(single)
      const registeredUser = await this.accountStore.getRegisteredUsers([admin_aggregateUserId ?? this.getCurrentUser().aggregateChatUserId]).then(single)

      if (registeredUser == null) {
        throw new ChatMateError('Expected registered user for aggregate user to be defined.')
      }

      return builder.success({
        registeredUser: registeredUserToPublic(registeredUser.registeredUser)!,
        channels: channels.channels.map(channelToPublicChannel)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/link/youtube/login')
  @PreProcessor(requireAuth)
  public getYoutubeLoginUrl (): GetYoutubeLoginUrlResponse {
    const builder = this.registerResponseBuilder<GetYoutubeLoginUrlResponse>('GET /link/youtube/login')

    try {
      const url = this.youtubeAuthProvider.getAuthUrl('user')

      return builder.success({ url })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/link/youtube')
  @PreProcessor(requireAuth)
  public async linkYoutubeChannel (
    @QueryParam('code') code: string
  ): Promise<LinkYoutubeChannelResponse> {
    const builder = this.registerResponseBuilder<LinkYoutubeChannelResponse>('POST /link/youtube')

    const validationError = builder.validateInput({ code: { type: 'string', validators: [nonEmptyStringValidator] }}, { code })
    if (validationError != null) {
      return validationError
    }

    try {
      await this.userLinkService.linkYoutubeAccountToUser(code, this.getCurrentUser().aggregateChatUserId)
      return builder.success({})
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/link/twitch/login')
  @PreProcessor(requireAuth)
  public getTwitchLoginUrl (): GetTwitchLoginUrlResponse {
    const builder = this.registerResponseBuilder<GetTwitchLoginUrlResponse>('GET /link/twitch/login')

    try {
      const url = this.twurpleAuthProvider.getLoginUrl('user')

      return builder.success({ url })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/link/twitch')
  @PreProcessor(requireAuth)
  public async linkTwitchChannel (
    @QueryParam('code') code: string
  ): Promise<LinkTwitchChannelResponse> {
    const builder = this.registerResponseBuilder<LinkTwitchChannelResponse>('POST /link/twitch')

    const validationError = builder.validateInput({ code: { type: 'string', validators: [nonEmptyStringValidator] }}, { code })
    if (validationError != null) {
      return validationError
    }

    try {
      await this.userLinkService.linkTwitchAccountToUser(code, this.getCurrentUser().aggregateChatUserId)
      return builder.success({})
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

    const validationError = builder.validateInput({
      aggregateUserId: { type: 'number' },
      defaultUserId: { type: 'number' }
    }, { aggregateUserId, defaultUserId })
    if (validationError != null) {
      return validationError
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

    const validationError = builder.validateInput({
      defaultUserId: { type: 'number' },
      transferRanks: { type: 'boolean', optional: true },
      relinkChatExperience: { type: 'boolean', optional: true },
      relinkDonations: { type: 'boolean', optional: true }
    }, { defaultUserId, transferRanks, relinkChatExperience, relinkDonations })
    if (validationError != null) {
      return validationError
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

    const validationError = builder.validateInput({ admin_aggregateUserId: { type: 'number', optional: true }}, { admin_aggregateUserId })
    if (validationError != null) {
      return validationError
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
            throw new ChatMateError(`Only a single channel is supported for default user ${userOwnedChannels.userId}`)
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

    const validationError = builder.validateInput({ externalId: { type: 'string', validators: [nonEmptyStringValidator] }}, { externalId })
    if (validationError != null) {
      return validationError
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

    const validationError = builder.validateInput({ linkToken: { type: 'string', validators: [nonEmptyStringValidator] }}, { linkToken })
    if (validationError != null) {
      return validationError
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
