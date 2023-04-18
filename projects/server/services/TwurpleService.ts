import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { evalTwitchPrivateMessage } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import { getUserName } from '@rebel/server/services/ChannelService'
import EventDispatchService, { EventData } from '@rebel/server/services/EventDispatchService'
import LogService from '@rebel/server/services/LogService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/shared/util/arrays'
import { ChatClient } from '@twurple/chat'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'
import { HelixUser, HelixUserApi } from '@twurple/api/lib'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { SubscriptionStatus } from '@rebel/server/services/StreamerTwitchEventService'

export type TwitchMetadata = {
  streamId: string
  startTime: Date
  title: string
  viewerCount: number
}

type Deps = Dependencies<{
  logService: LogService
  twurpleChatClientProvider: TwurpleChatClientProvider
  twurpleApiClientProvider: TwurpleApiClientProvider
  twurpleApiProxyService: TwurpleApiProxyService
  disableExternalApis: boolean
  channelStore: ChannelStore
  eventDispatchService: EventDispatchService
  accountStore: AccountStore
  streamerStore: StreamerStore
  streamerChannelService: StreamerChannelService
  isAdministrativeMode: () => boolean
}>

export default class TwurpleService extends ContextClass {
  readonly name = TwurpleService.name

  private readonly logService: LogService
  private readonly chatClientProvider: TwurpleChatClientProvider
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly twurpleApiProxyService: TwurpleApiProxyService
  private readonly disableExternalApis: boolean
  private readonly channelStore: ChannelStore
  private readonly eventDispatchService: EventDispatchService
  private readonly accountStore: AccountStore
  private readonly streamerStore: StreamerStore
  private readonly streamerChannelService: StreamerChannelService
  private readonly isAdministrativeMode: () => boolean
  private userApi!: HelixUserApi
  private chatClient!: ChatClient

  /** The keys are the channel names in lowercase characters. */
  private channelChatStatus: Map<string, SubscriptionStatus> = new Map()

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.chatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.channelStore = deps.resolve('channelStore')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.accountStore = deps.resolve('accountStore')
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerChannelService = deps.resolve('streamerChannelService')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
  }

  public override async initialise () {
    if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    this.chatClient = this.chatClientProvider.get()
    this.userApi = this.twurpleApiClientProvider.get().users

    if (this.disableExternalApis) {
      return
    } else if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.chatClient.onMessage((channel, user, message, msg) => this.onMessage(channel, user, message, msg))

    this.chatClient.onConnect(() => this.logService.logInfo(this, 'Connected.'))
    this.chatClient.onDisconnect((manually, reason) => this.logService.logInfo(this, 'Disconnected. Manually:', manually, 'Reason:', reason))
    this.chatClient.onAuthenticationFailure(msg => this.logService.logError(this, 'chatClient.onAuthenticationFailure', msg))
    this.chatClient.onJoinFailure((channel, reason) => this.logService.logError(this, 'chatClient.onJoinFailure', channel, reason))
    this.chatClient.onJoin((channel, user) => this.logService.logInfo(this, 'chatClient.onJoin', channel, user))
    this.chatClient.onPart((channel, user) => this.logService.logInfo(this, 'chatClient.onPart', channel, user))
    this.chatClient.onMessageFailed((channel, reason) => this.logService.logError(this, 'chatClient.onMessageFailed', channel, reason))
    this.chatClient.onMessageRatelimit((channel, msg) => this.logService.logError(this, 'chatClient.onMessageRatelimit', channel, msg))
    this.chatClient.onNoPermission((channel, msg) => this.logService.logError(this, 'chatClient.onNoPermission', channel, msg))

    // todo: how do these compare to the EventSub?
    this.chatClient.onBan((channel, user) => this.logService.logInfo(this, 'chatClient.onBan', channel, user))
    this.chatClient.onTimeout((channel, user, duration) => this.logService.logInfo(this, 'chatClient.onTimeout', channel, user, duration))

    await this.joinStreamerChannels()

    this.eventDispatchService.onData('addPrimaryChannel', data => this.onPrimaryChannelAdded(data))
    this.eventDispatchService.onData('removePrimaryChannel', data => this.onPrimaryChannelRemoved(data))
  }

  public async banChannel (streamerId: number, twitchChannelId: number, reason: string | null) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.ban(broadcaster, user, reason ?? undefined)
  }

  /** Returns null if the streamer does not have a primary Twitch channel. */
  public async getChatStatus (streamerId: number): Promise<SubscriptionStatus | null> {
    const twitchChannelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (twitchChannelName == null) {
      return null
    }

    const status = this.channelChatStatus.get(twitchChannelName.toLowerCase())
    return status ?? { status: 'inactive' }
  }

  public async modChannel (streamerId: number, twitchChannelId: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.mod(broadcaster, user)
  }

  public async timeout (streamerId: number, twitchChannelId: number, reason: string | null, durationSeconds: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.timeout(broadcaster, user, durationSeconds, reason ?? undefined)
  }

  public async unbanChannel (streamerId: number, twitchChannelId: number) {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    // todo: does it make sense to use say commands exclusively? they are much simpler, with less overhead
    // there is no API for unbanning a user, but the `ban` implementation is essentially just a wrapper around the `say` method, so we can manually use it here
    const channel = single(await this.channelStore.getTwitchChannelFromChannelId([twitchChannelId]))
    const twitchUserName = channel.platformInfo.channel.infoHistory[0].userName
    this.twurpleApiProxyService.say(channelName, `/unban ${twitchUserName}`)
  }

  public async unmodChannel (streamerId: number, twitchChannelId: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.unmod(broadcaster, user)
  }

  public async untimeout (streamerId: number, twitchChannelId: number, reason: string | null) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    // there is no API for removing a timeout, but a legitimate workaround is to add a new timeout that lasts for 1 second, which will overwrite the existing timeout
    const twitchUserName = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.timeout(broadcaster, twitchUserName, 1, reason ?? undefined)
  }

  private async onPrimaryChannelAdded (data: EventData['addPrimaryChannel']) {
    if (data.userChannel.platformInfo.platform !== 'twitch') {
      return
    }

    const channelName = getUserName(data.userChannel)
    await this.joinSafe(channelName, data.streamerId)
  }

  private onPrimaryChannelRemoved (data: EventData['removePrimaryChannel']) {
    if (data.userChannel.platformInfo.platform !== 'twitch') {
      return
    }

    const channelName = getUserName(data.userChannel)
    try {
      this.chatClient.part(channelName)
      this.logService.logInfo(this, `Successfully left the chat for channel ${channelName} (streamerId ${data.streamerId})`)
    } catch (e: any) {
      this.logService.logError(this, `Failed to leave the chat for channel ${channelName} (streamerId ${data.streamerId})`, e)
    }

    this.channelChatStatus.delete(channelName.toLowerCase())
  }

  private async getTwitchUserFromChannelId (internalTwitchChannelId: number): Promise<HelixUser> {
    const channel = single(await this.channelStore.getTwitchChannelFromChannelId([internalTwitchChannelId]))
    const channelName = channel.platformInfo.channel.infoHistory[0].userName
    const user = await this.userApi.getUserByName(channelName)
    if (user == null) {
      throw new Error(`Unable to get HelixUser for Twitch channel ${channelName} (internal id ${internalTwitchChannelId})`)
    }

    return user
  }

  private async getTwitchUserFromStreamerId (streamerId: number): Promise<HelixUser | null> {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return null
    }

    const user = await this.userApi.getUserByName(channelName)
    if (user == null) {
      throw new Error(`Unable to get HelixUser for Twitch channel ${channelName} (streamerId ${streamerId})`)
    }

    return user
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
    await Promise.all(channels.map(c => this.joinSafe(c.twitchChannelName, c.streamerId)))
  }

  private async joinSafe (channelName: string, streamerId: number): Promise<void> {
    try {
      await this.chatClient.join(channelName)
      this.channelChatStatus.set(channelName.toLowerCase(), { status: 'active' })
      this.logService.logInfo(this, `Successfully joined the chat for channel ${channelName} (streamerId ${streamerId})`)
    } catch (e: any) {
      this.channelChatStatus.set(channelName.toLowerCase(), { status: 'inactive', message: e.message ?? 'Unknown error' })
      this.logService.logError(this, `Failed to join the chat for channel ${channelName} (streamerId ${streamerId})`, e)
    }
  }
}
