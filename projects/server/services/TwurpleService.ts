import { Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { evalTwitchPrivateMessage } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import EventDispatchService from '@rebel/server/services/EventDispatchService'
import LogService from '@rebel/server/services/LogService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { ChatClient } from '@twurple/chat'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'

type Deps = Dependencies<{
  logService: LogService
  twurpleChatClientProvider: TwurpleChatClientProvider
  twurpleApiProxyService: TwurpleApiProxyService
  disableExternalApis: boolean
  channelStore: ChannelStore
  eventDispatchService: EventDispatchService
  accountStore: AccountStore
  streamerStore: StreamerStore
  streamerChannelService: StreamerChannelService
}>

export default class TwurpleService extends ContextClass {
  readonly name = TwurpleService.name

  private readonly logService: LogService
  private readonly chatClientProvider: TwurpleChatClientProvider
  private readonly twurpleApiProxyService: TwurpleApiProxyService
  private readonly disableExternalApis: boolean
  private readonly channelStore: ChannelStore
  private readonly eventDispatchService: EventDispatchService
  private readonly accountStore: AccountStore
  private readonly streamerStore: StreamerStore
  private readonly streamerChannelService: StreamerChannelService
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.chatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.channelStore = deps.resolve('channelStore')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.accountStore = deps.resolve('accountStore')
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerChannelService = deps.resolve('streamerChannelService')
  }

  public override async initialise () {
    this.chatClient = this.chatClientProvider.get()
    if (this.disableExternalApis) {
      return
    }

    this.chatClient.onMessage((channel, user, message, msg) => this.onMessage(channel, user, message, msg) as any as void) // it doesn't like async message handlers, but not much we can do about that

    this.chatClient.onAuthenticationFailure(msg => this.logService.logError(this, 'chatClient.onAuthenticationFailure', msg))
    this.chatClient.onJoinFailure((channel, reason) => this.logService.logError(this, 'chatClient.onJoinFailure', channel, reason))
    this.chatClient.onJoin((channel, user) => this.logService.logInfo(this, 'chatClient.onJoin', channel, user))
    this.chatClient.onMessageFailed((channel, reason) => this.logService.logError(this, 'chatClient.onMessageFailed', channel, reason))
    this.chatClient.onMessageRatelimit((channel, msg) => this.logService.logError(this, 'chatClient.onMessageRatelimit', channel, msg))
    this.chatClient.onNoPermission((channel, msg) => this.logService.logError(this, 'chatClient.onNoPermission', channel, msg))

    // todo: how do these compare to the EventSub?
    this.chatClient.onBan((channel, user) => this.logService.logInfo(this, 'chatClient.onBan', channel, user))
    this.chatClient.onTimeout((channel, user, duration) => this.logService.logInfo(this, 'chatClient.onTimeout', channel, user, duration))

    // represents an info message in chat, e.g. confirmation that an action was successful
    this.chatClient.onNotice((target, user, msg, notice) => this.logService.logInfo(this, 'chatClient.onNotice', target, user, msg, notice))

    await this.joinStreamerChannels()
  }

  public async banChannel (streamerId: number, twitchChannelId: number, reason: string | null) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.ban(channelName, twitchUserName, reason ?? undefined)
  }

  public async modChannel (streamerId: number, twitchChannelId: number) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.mod(channelName, twitchUserName)
  }

  /** Instructs the Twurple chat client to start listening for messages on the streamer's Twitch channel, if it exists. */
  public async joinChannel (streamerId: number) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    await this.chatClient.join(channelName)
  }

  public async timeout (streamerId: number, twitchChannelId: number, reason: string | null, durationSeconds: number) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.timeout(channelName, twitchUserName, durationSeconds, reason ?? undefined)
  }

  public async unbanChannel (streamerId: number, twitchChannelId: number) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    // there is no API for unbanning a user, but the `ban` implementation is essentially just a wrapper around the `say` method, so we can manually use it here
    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    this.twurpleApiProxyService.say(channelName, `/unban ${twitchUserName}`)
  }

  public async unmodChannel (streamerId: number, twitchChannelId: number) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.unmod(channelName, twitchUserName)
  }

  public async untimeout (streamerId: number, twitchChannelId: number, reason: string | null) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    // there is no API for removing a timeout, but a legitimate workaround is to add a new timeout that lasts for 1 second, which will overwrite the existing timeout
    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.timeout(channelName, twitchUserName, 1, reason ?? undefined)
  }

  private async onMessage (_channel: string, _user: string, _message: string, msg: TwitchPrivateMessage) {
    try {
      const evaluated = evalTwitchPrivateMessage(msg)
      const channelId = msg.channelId
      if (channelId == null) {
        throw new Error(`Cannot add Twitch chat message from channel ${_channel} because the message's channelId property was null`)
      }

      const chatUserId = await this.channelStore.getPrimaryUserId(channelId)
      const registeredUser = await this.accountStore.getRegisteredUserFromAggregateUser(chatUserId)
      if (registeredUser == null) {
        throw new Error(`Cannot add Twitch chat message from channel ${_channel} (id ${channelId}) because the chat user ${chatUserId} is not associated with a registered user`)
      }

      const streamer = await this.streamerStore.getStreamerByRegisteredUserId(registeredUser.id)
      if (streamer == null) {
        throw new Error(`Cannot add Twitch chat message from channel ${_channel} (id ${channelId}) because the registered user ${registeredUser.id} is not a streamer`)
      }

      this.logService.logInfo(this, _channel, 'Adding 1 new chat item')
      this.eventDispatchService.addData('chatItem', { ...evaluated, streamerId: streamer.id })
    } catch (e: any) {
      this.logService.logError(this, e)
    }
  }

  private async joinStreamerChannels (): Promise<void> {
    const channels = await this.streamerChannelService.getAllTwitchStreamerChannels()
    await Promise.all(channels.map(c => this.chatClient.join(c.twitchChannelName)))
  }
}
