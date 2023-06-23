import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { GET, Path, PreProcessor } from 'typescript-rest'
import { requireRank } from '@rebel/server/controllers/preProcessors'
import MasterchatService from '@rebel/server/services/MasterchatService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { ChatMateStatsResponse, GetChatMateRegisteredUsernameResponse, GetMasterchatAuthenticationResponse, PingResponse } from '@rebel/api-models/schema/chatMate'

type Deps = ControllerDependencies<{
  masterchatService: MasterchatService
  chatMateRegisteredUserName: string
  streamerStore: StreamerStore
  accountStore: AccountStore
  channelStore: ChannelStore
  chatStore: ChatStore
  experienceStore: ExperienceStore
  livestreamStore: LivestreamStore
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
  }

  @GET
  @Path('/ping')
  public ping (): PingResponse {
    const builder = this.registerResponseBuilder<PingResponse>('GET /ping')
    return builder.success({})
  }

  @GET
  @Path('/stats')
  public async getStats (): Promise<ChatMateStatsResponse> {
    const builder = this.registerResponseBuilder<ChatMateStatsResponse>('GET /stats')
    try {
      const streamerCount = await this.streamerStore.getStreamerCount()
      const registeredUserCount = await this.accountStore.getRegisteredUserCount()
      const channelCount = await this.channelStore.getChannelCount()
      const messageCount = await this.chatStore.getChatMessageCount()
      const totalExperience = await this.experienceStore.getTotalGlobalExperience()
      const totalDaysLivestreamed = await this.livestreamStore.getTotalDaysLivestreamed()

      return builder.success({
        streamerCount: streamerCount,
        registeredUserCount: registeredUserCount,
        uniqueChannelCount: channelCount,
        chatMessageCount: messageCount,
        totalExperience: totalExperience,
        totalDaysLivestreamed: totalDaysLivestreamed
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/masterchat/authentication')
  @PreProcessor(requireRank('admin'))
  public getMasterchatAuthentication (): GetMasterchatAuthenticationResponse {
    const builder = this.registerResponseBuilder<GetMasterchatAuthenticationResponse>('GET /masterchat/authentication')
    try {
      return builder.success({ authenticated: this.masterchatService.checkCredentials() })
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
