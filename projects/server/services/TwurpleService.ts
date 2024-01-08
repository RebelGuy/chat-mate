import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { evalTwitchPrivateMessage } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import { getUserName } from '@rebel/server/services/ChannelService'
import EventDispatchService, { EVENT_ADD_PRIMARY_CHANNEL, EVENT_CHAT_ITEM, EVENT_CHAT_ITEM_REMOVED, EVENT_REMOVE_PRIMARY_CHANNEL, EventData } from '@rebel/server/services/EventDispatchService'
import LogService from '@rebel/server/services/LogService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/shared/util/arrays'
import { ChatClient, ClearMsg } from '@twurple/chat'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'
import { HelixUser, HelixUserApi } from '@twurple/api/lib'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { SubscriptionStatus } from '@rebel/server/services/StreamerTwitchEventService'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import { AuthorisationExpiredError, InconsistentScopesError, TwitchNotAuthorisedError } from '@rebel/shared/util/error'
import { waitUntil } from '@rebel/shared/util/typescript'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'

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
  twurpleAuthProvider: TwurpleAuthProvider
  twurpleApiProxyService: TwurpleApiProxyService
  disableExternalApis: boolean
  channelStore: ChannelStore
  eventDispatchService: EventDispatchService
  accountStore: AccountStore
  streamerStore: StreamerStore
  streamerChannelService: StreamerChannelService
  isAdministrativeMode: () => boolean
  isContextInitialised: () => boolean
  dateTimeHelpers: DateTimeHelpers
  twitchUsername: string
  timerHelpers: TimerHelpers
}>

export default class TwurpleService extends ContextClass {
  readonly name = TwurpleService.name

  private readonly logService: LogService
  private readonly chatClientProvider: TwurpleChatClientProvider
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly twurpleAuthProvider: TwurpleAuthProvider
  private readonly twurpleApiProxyService: TwurpleApiProxyService
  private readonly disableExternalApis: boolean
  private readonly channelStore: ChannelStore
  private readonly eventDispatchService: EventDispatchService
  private readonly accountStore: AccountStore
  private readonly streamerStore: StreamerStore
  private readonly streamerChannelService: StreamerChannelService
  private readonly isAdministrativeMode: () => boolean
  private readonly isContextInitialised: () => boolean
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly timerHelpers: TimerHelpers
  private userApi!: HelixUserApi
  private chatClient!: ChatClient

  /** The keys are the channel names in lowercase characters. */
  private channelChatStatus: Map<string, SubscriptionStatus> = new Map()

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.chatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.twurpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.channelStore = deps.resolve('channelStore')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.accountStore = deps.resolve('accountStore')
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerChannelService = deps.resolve('streamerChannelService')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
    this.isContextInitialised = deps.resolve('isContextInitialised')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.timerHelpers = deps.resolve('timerHelpers')
  }

  public override async initialise () {
    if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    this.chatClient = this.chatClientProvider.get()
    this.userApi = await this.twurpleApiClientProvider.get(null).then(client => client.users)

    if (this.disableExternalApis) {
      return
    } else if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.chatClient.onMessage((channel, user, message, msg) => this.onMessage(channel, user, message, msg))
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.chatClient.onMessageRemove((channel: string, messageId: string, msg: ClearMsg) => this.onMessageRemoved(channel, messageId))

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.chatClient.onConnect(() => this.onConnected())

    this.chatClient.onDisconnect((manually, reason) => this.onDisconnected(manually, reason))
    this.chatClient.onAuthenticationFailure(msg => this.logService.logError(this, 'chatClient.onAuthenticationFailure', msg))
    this.chatClient.onJoinFailure((channel, reason) => this.logService.logError(this, 'chatClient.onJoinFailure', channel, reason))
    this.chatClient.onJoin((channel, user) => this.logService.logInfo(this, 'chatClient.onJoin', channel, user))
    this.chatClient.onPart((channel, user) => this.onParted(channel, user))
    this.chatClient.onMessageFailed((channel, reason) => this.logService.logError(this, 'chatClient.onMessageFailed', channel, reason))
    this.chatClient.onMessageRatelimit((channel, msg) => this.logService.logError(this, 'chatClient.onMessageRatelimit', channel, msg))
    this.chatClient.onNoPermission((channel, msg) => this.logService.logError(this, 'chatClient.onNoPermission', channel, msg))

    // todo: how do these compare to the EventSub?
    this.chatClient.onBan((channel, user) => this.logService.logInfo(this, 'chatClient.onBan', channel, user))
    this.chatClient.onTimeout((channel, user, duration) => this.logService.logInfo(this, 'chatClient.onTimeout', channel, user, duration))

    this.eventDispatchService.onData(EVENT_ADD_PRIMARY_CHANNEL, data => this.onPrimaryChannelAdded(data))
    this.eventDispatchService.onData(EVENT_REMOVE_PRIMARY_CHANNEL, data => this.onPrimaryChannelRemoved(data))
  }

  public async banChannel (streamerId: number, twitchChannelId: number, reason: string | null) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.ban(streamerId, broadcaster, user, reason ?? undefined)
  }

  /** Returns null if the streamer does not have a primary Twitch channel. */
  public async getChatStatus (streamerId: number): Promise<SubscriptionStatus | null> {
    const twitchChannelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (twitchChannelName == null) {
      return null
    }

    if (this.chatClient.isConnecting) {
      return {
        status: 'pending',
        lastChange: this.dateTimeHelpers.ts()
      }
    } else if (!this.chatClient.isConnected) {
      return {
        status: 'inactive',
        message: 'ChatMate is not connected to the Twitch chat server.',
        lastChange: this.dateTimeHelpers.ts()
      }
    }

    const status = this.channelChatStatus.get(twitchChannelName.toLowerCase())
    if (status == null) {
      return {
        status: 'inactive',
        lastChange: this.dateTimeHelpers.ts()
      }
    }

    let errorMessage: string | null = null
    let isActive: boolean = true
    const user = await this.userApi.getUserByName(twitchChannelName)
    try {
      await this.twurpleAuthProvider.getUserTokenAuthProvider(user!.id, true)
    } catch (e: any) {
      if (e instanceof TwitchNotAuthorisedError) {
        errorMessage = 'You have not yet authorised ChatMate to act on your behalf.'
        isActive = false
      } else if (e instanceof AuthorisationExpiredError) {
        errorMessage = 'Your previous authorisation of ChatMate has expired. Re-authorisation is required.'
        isActive = false
      } else if (e instanceof InconsistentScopesError) {
        errorMessage = 'You have authorised ChatMate to act on your behalf, but the permissions that ChatMate requires have changed since then. Re-authorisation is required.'
        isActive = false
      } else {
        throw e
      }
    }

    const hasUser = this.twurpleAuthProvider.hasTokenForUser(user!.id)
    if (!hasUser && errorMessage == null) {
      errorMessage = `Currently listening to chat messages, but unable to perform moderator actions because of missing permissions. Please authorise ChatMate to act on your behalf.`
      isActive = true
    }

    if (errorMessage != null) {
      return {
        status: isActive ? 'active' : 'inactive',
        lastChange: this.dateTimeHelpers.ts(),
        message: errorMessage,
        requiresAuthorisation: true
      }
    }

    if (status.status === 'active' && !this.chatClient.currentChannels.map(c => c.toLowerCase().replace('#', '')).includes(twitchChannelName.toLowerCase())) {
      return {
        status: 'inactive',
        lastChange: this.dateTimeHelpers.ts(),
        message: 'The ChatMate state is out of sync with the Twitch state.'
      }
    }

    return status
  }

  public async modChannel (streamerId: number, twitchChannelId: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.mod(streamerId, broadcaster, user)
  }

  public reconnectClient () {
    void this.chatClient.reconnect()
  }

  public async timeout (streamerId: number, twitchChannelId: number, reason: string | null, durationSeconds: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.timeout(streamerId, broadcaster, user, durationSeconds, reason ?? undefined)
  }

  public async unbanChannel (streamerId: number, twitchChannelId: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.unban(streamerId, broadcaster, user)
  }

  public async unmodChannel (streamerId: number, twitchChannelId: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.unmod(streamerId, broadcaster, user)
  }

  public async untimeout (streamerId: number, twitchChannelId: number) {
    const broadcaster = await this.getTwitchUserFromStreamerId(streamerId)
    if (broadcaster == null) {
      return
    }

    const user = await this.getTwitchUserFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.unTimeout(streamerId, broadcaster, user)
  }

  private async onPrimaryChannelAdded (data: EventData[typeof EVENT_ADD_PRIMARY_CHANNEL]) {
    if (data.userChannel.platformInfo.platform !== 'twitch') {
      return
    }

    const channelName = getUserName(data.userChannel)
    await this.joinSafe(channelName, data.streamerId)
  }

  private onPrimaryChannelRemoved (data: EventData[typeof EVENT_REMOVE_PRIMARY_CHANNEL]) {
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
    const channel = single(await this.channelStore.getTwitchChannelsFromChannelIds([internalTwitchChannelId]))
    const channelName = channel.platformInfo.channel.globalInfoHistory[0].userName
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
      this.eventDispatchService.addData(EVENT_CHAT_ITEM, { ...evaluated, streamerId: streamer.id })
    } catch (e: any) {
      this.logService.logError(this, e)
    }
  }

  private async onMessageRemoved (channel: string, messageId: string) {
    this.logService.logInfo(this, channel, `Removing chat item ${messageId}`)
    await this.eventDispatchService.addData(EVENT_CHAT_ITEM_REMOVED, { externalMessageId: messageId })
  }

  private async onConnected () {
    this.logService.logInfo(this, 'Connected.')

    await waitUntil(() => this.isContextInitialised(), 500, 5 * 60_000)
    await this.joinStreamerChannels()
  }

  private onDisconnected (manually: boolean, reason: Error | undefined): void {
    this.logService.logInfo(this, 'Disconnected. Manually:', manually, 'Reason:', reason)
    if (this.chatClient.isConnected) {
      this.logService.logWarning(this, 'ChatClient is not actually disconnected... ignoring')
    } else {
      this.channelChatStatus.clear()
    }
  }

  private onParted (channel: string, user: string): void {
    this.logService.logInfo(this, 'chatClient.onPart', channel, user)
    this.channelChatStatus.delete(channel.toLowerCase())
  }

  private async joinStreamerChannels (): Promise<void> {
    this.logService.logInfo(this, 'Joining chat rooms...')
    const channels = await this.streamerChannelService.getAllTwitchStreamerChannels()
    await Promise.all(channels.map(c => this.joinSafe(c.twitchChannelName, c.streamerId)))
    this.logService.logInfo(this, 'Finished joining chat rooms')
  }

  private async joinSafe (channelName: string, streamerId: number): Promise<void> {
    try {
      await this.chatClient.join(channelName)
      const status: SubscriptionStatus = {
        status: 'active',
        lastChange: this.dateTimeHelpers.ts()
      }
      this.channelChatStatus.set(channelName.toLowerCase(), status)
      this.logService.logInfo(this, `Successfully joined the chat for channel ${channelName} (streamerId ${streamerId})`)
    } catch (e: any) {
      const status: SubscriptionStatus = {
        status: 'inactive',
        message: e.message ?? 'Unknown error',
        lastChange: this.dateTimeHelpers.ts()
      }
      this.channelChatStatus.set(channelName.toLowerCase(), status)
      this.logService.logError(this, `Failed to join the chat for channel ${channelName} (streamerId ${streamerId})`, e)
    }
  }
}
