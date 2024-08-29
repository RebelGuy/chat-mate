import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { GET, Path, PreProcessor, QueryParam } from 'typescript-rest'
import { requireRank } from '@rebel/server/controllers/preProcessors'
import MasterchatService from '@rebel/server/services/MasterchatService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { ChatMateStatsResponse, GetChatMateRegisteredUsernameResponse, GetMasterchatAuthenticationResponse, PingResponse } from '@rebel/api-models/schema/chatMate'
import CacheService from '@rebel/server/services/CacheService'
import AggregateLivestreamService from '@rebel/server/services/AggregateLivestreamService'
import { flatMap } from '@rebel/shared/util/arrays'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import { ONE_DAY } from '@rebel/shared/util/datetime'
import LiveReactionStore from '@rebel/server/stores/LiveReactionStore'
import VisitorStore from '@rebel/server/stores/VisitorStore'

type Deps = ControllerDependencies<{
  masterchatService: MasterchatService
  chatMateRegisteredUserName: string
  streamerStore: StreamerStore
  accountStore: AccountStore
  channelStore: ChannelStore
  chatStore: ChatStore
  experienceStore: ExperienceStore
  livestreamStore: LivestreamStore
  cacheService: CacheService
  aggregateLivestreamService: AggregateLivestreamService
  streamerChannelStore: StreamerChannelStore
  liveReactionStore: LiveReactionStore
  visitorStore: VisitorStore
}>

@Path(buildPath('chatMate'))
export default class ChatMateController extends ControllerBase {
  private readonly masterchatService: MasterchatService
  private readonly chatMateRegisteredUserName: string
  private readonly streamerStore: StreamerStore
  private readonly accountStore: AccountStore
  private readonly channelStore: ChannelStore
  private readonly chatStore: ChatStore
  private readonly experienceStore: ExperienceStore
  private readonly livestreamStore: LivestreamStore
  private readonly cacheService: CacheService
  private readonly aggregateLivestreamService: AggregateLivestreamService
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly liveReactionStore: LiveReactionStore
  private readonly visitorStore: VisitorStore

  constructor (deps: Deps) {
    super(deps, 'chatMate')
    this.masterchatService = deps.resolve('masterchatService')
    this.chatMateRegisteredUserName = deps.resolve('chatMateRegisteredUserName')
    this.streamerStore = deps.resolve('streamerStore')
    this.accountStore = deps.resolve('accountStore')
    this.channelStore = deps.resolve('channelStore')
    this.chatStore = deps.resolve('chatStore')
    this.experienceStore = deps.resolve('experienceStore')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.cacheService = deps.resolve('cacheService')
    this.aggregateLivestreamService = deps.resolve('aggregateLivestreamService')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.liveReactionStore = deps.resolve('liveReactionStore')
    this.visitorStore = deps.resolve('visitorStore')
  }

  @GET
  @Path('/ping')
  public ping (): PingResponse {
    const builder = this.registerResponseBuilder<PingResponse>('GET /ping')
    return builder.success({})
  }

  @GET
  @Path('/stats')
  public async getStats (
    @QueryParam('since') since?: number
  ): Promise<ChatMateStatsResponse> {
    const builder = this.registerResponseBuilder<ChatMateStatsResponse>('GET /stats')

    const validationError = builder.validateInput({
      since: { type: 'number', optional: true }
    }, { since })
    if (validationError != null) {
      return validationError
    }

    since = since ?? 0

    try {
      const totalVisitors = await this.visitorStore.getUniqueVisitors()
      const chatMateStreamerId = await this.cacheService.chatMateStreamerId.resolve()
      const streamers = await this.streamerStore.getStreamers().then(_streamers => _streamers.filter(s => s.id !== chatMateStreamerId))
      const primaryChannels = await this.streamerChannelStore.getPrimaryChannels(streamers.map(streamer => streamer.id))
      const registeredUserCount = await this.accountStore.getRegisteredUserCount()
      const youtubeChannelCount = await this.channelStore.getYoutubeChannelCount()
      const twitchChannelCount = await this.channelStore.getTwitchChannelCount()
      const youtubeMessageCount = await this.chatStore.getYoutubeChatMessageCount()
      const twitchMessageCount = await this.chatStore.getTwitchChatMessageCount()
      const youtubeLiveReactions = await this.liveReactionStore.getTotalLiveReactions()
      const totalExperience = await this.experienceStore.getTotalGlobalExperience()
      // todo: this is a big no-no, we should probably cache things that we know will never change (e.g. past livestreams)
      const aggregateLivestreams = await Promise.all(streamers.map(streamer => this.aggregateLivestreamService.getAggregateLivestreams(streamer.id))).then(flatMap)
      const youtubeTotalDaysLivestreamed = await this.livestreamStore.getYoutubeTotalDaysLivestreamed(since)
      const twitchTotalDaysLivestreamed = await this.livestreamStore.getTwitchTotalDaysLivestreamed()

      return builder.success({
        totalVisitors: totalVisitors,
        streamerCount: streamers.length,
        youtubeStreamerCount: primaryChannels.filter(pc => pc.youtubeChannel != null).length,
        twitchStreamerCount: primaryChannels.filter(pc => pc.twitchChannel != null).length,
        registeredUserCount: registeredUserCount,
        uniqueChannelCount: youtubeChannelCount + twitchChannelCount,
        uniqueYoutubeChannelCount: youtubeChannelCount,
        uniqueTwitchChannelCount: twitchChannelCount,
        chatMessageCount: youtubeMessageCount + twitchMessageCount,
        youtubeMessageCount: youtubeMessageCount,
        twitchMessageCount: twitchMessageCount,
        youtubeLiveReactions: youtubeLiveReactions,
        totalExperience: totalExperience,
        totalDaysLivestreamed: aggregateLivestreams.reduce((time, livestream) => time + livestream.getDuration(), 0) / ONE_DAY,
        youtubeTotalDaysLivestreamed: youtubeTotalDaysLivestreamed,
        twitchTotalDaysLivestreamed: twitchTotalDaysLivestreamed
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/masterchat/authentication')
  @PreProcessor(requireRank('admin'))
  public async getMasterchatAuthentication (): Promise<GetMasterchatAuthenticationResponse> {
    const builder = this.registerResponseBuilder<GetMasterchatAuthenticationResponse>('GET /masterchat/authentication')

    try {
      const result = await this.masterchatService.checkAuthentication()

      return builder.success({
        authenticated: result?.isActive ?? null,
        lastUpdatedTimestamp: result?.lastUpdated?.getTime() ?? null
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/username')
  public getChatMateRegisteredUsername (): GetChatMateRegisteredUsernameResponse {
    const builder = this.registerResponseBuilder<GetChatMateRegisteredUsernameResponse>('GET /username')
    try {
      return builder.success({ username: this.chatMateRegisteredUserName })
    } catch (e: any) {
      return builder.failure(404, e)
    }
  }
}
