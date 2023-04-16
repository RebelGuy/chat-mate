
import { Dependencies } from '@rebel/shared/context/context'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ApiService from '@rebel/server/services/abstract/ApiService'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import { DeepPartial } from '@rebel/shared/types'
import { ApiClient, HelixBanUserRequest, HelixUser, UserIdResolvable } from '@twurple/api'
import { ChatClient, ChatSayMessageAttributes } from '@twurple/chat/lib'
import { TwitchMetadata } from '@rebel/server/services/TwurpleService'

type Deps = Dependencies<{
  logService: LogService
  twurpleStatusService: StatusService
  twurpleApiClientProvider: TwurpleApiClientProvider
  twurpleChatClientProvider: TwurpleChatClientProvider
  isAdministrativeMode: () => boolean
}>

/** Provides access to Twurple API calls - should be a general proxy, not chat-mate specific (that's what the TwurpleService is for). */
export default class TwurpleApiProxyService extends ApiService {
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly twurpleChatClientProvider: TwurpleChatClientProvider
  private readonly isAdministrativeMode: () => boolean
  private api!: ApiClient
  private wrappedApi!: DeepPartial<ApiClient>
  private chat!: ChatClient
  private wrappedChat!: DeepPartial<ChatClient>
  private chatMateModeratorId!: string

  constructor (deps: Deps) {
    const name = TwurpleApiProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('twurpleStatusService')
    const timeout = 5000 // thanks to Twitch's messaging system (or a bug in Twurple?) we don't always hear back, so assume the request failed after 5 seconds
    super(name, logService, statusService, timeout)

    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.twurpleChatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
  }

  public override async initialise (): Promise<void> {
    if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    this.api = this.twurpleApiClientProvider.get()
    this.wrappedApi = this.createApiWrapper()

    this.chat = this.twurpleChatClientProvider.get()
    this.wrappedChat = this.createChatWrapper()

    const user = await this.api.users.getUserByName('chat_mate1') // todo CHAT-444: use the ChatMate user
    this.chatMateModeratorId = user!.id
  }

  public async ban (broadcaster: HelixUser, twitchUser: HelixUser, reason?: string): Promise<void> {
    const data: HelixBanUserRequest = {
      user: twitchUser,
      reason: reason ?? '<no reason provided>'
    }
    await this.wrappedApi.moderation!.banUser!(broadcaster, this.chatMateModeratorId, data)
  }

  /** Returns null if the stream hasn't started. */
  public async fetchMetadata (channelName: string): Promise<TwitchMetadata | null> {
    const stream = await this.wrappedApi.streams!.getStreamByUserName!(channelName)

    if (stream == null) {
      return null
    }

    return {
      streamId: stream.id,
      startTime: stream.startDate,
      title: stream.title,
      viewerCount: stream.viewers
    }
  }

  public async mod (broadcaster: HelixUser, user: HelixUser) {
    await this.wrappedApi.moderation!.addModerator!(broadcaster, user)
  }

  /** Says the message in chat. For the list of available commands that can be said, refer to https://help.twitch.tv/s/article/chat-commands (must include an initial `/`) */
  public async say (channel: string, message: string) {
    await this.wrappedChat.say!(channel, message, undefined)
  }

  public async timeout (broadcaster: HelixUser, twitchUser: HelixUser, durationSeconds: number, reason?: string): Promise<void> {
    const data: HelixBanUserRequest = {
      user: twitchUser,
      duration: durationSeconds,
      reason: reason ?? '<no reason provided>'
    }
    await this.wrappedApi.moderation!.banUser!(broadcaster, this.chatMateModeratorId, data)
  }

  public async unmod (broadcaster: HelixUser, user: HelixUser) {
    await this.wrappedApi.moderation!.removeModerator!(broadcaster, user)
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createApiWrapper = (): DeepPartial<ApiClient> => {
    const getStreamByUserName = super.wrapRequest((userName: string) => this.api.streams.getStreamByUserName(userName), 'twurpleApiClient.streams.getStreamByUserName')
    const banUser = super.wrapRequest((broadcaster: UserIdResolvable, moderator: UserIdResolvable, data: HelixBanUserRequest) => this.api.moderation.banUser(broadcaster, moderator, data), 'twurpleChatClient.ban')
    const addModerator = super.wrapRequest((channel: string, twitchUserName: string) => this.api.moderation.addModerator(channel, twitchUserName), 'twurpleChatClient.mod')
    const removeModerator = super.wrapRequest((channel: string, twitchUserName: string) => this.api.moderation.removeModerator(channel, twitchUserName), 'twurpleChatClient.unmod')

    return {
      streams: {
        getStreamByUserName
      }, moderation: {
        banUser,
        addModerator,
        removeModerator
      }
    }
  }

  private createChatWrapper = (): Partial<ChatClient> => {
    const say = super.wrapRequest((channel: string, message: string, attributes: ChatSayMessageAttributes | undefined) => this.chat.say(channel, message, attributes), 'twurpleChatClient.say')

    return {
      say,
    }
  }
}
