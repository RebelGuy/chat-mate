
import { Dependencies } from '@rebel/shared/context/context'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ChatItem, ChatItemWithRelations, ChatPlatform } from '@rebel/server/models/chat'
import LogService, {  } from '@rebel/server/services/LogService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ContextClass from '@rebel/shared/context/ContextClass'
import ChannelStore, { YoutubeChannelWithLatestInfo, CreateOrUpdateGlobalYoutubeChannelArgs, CreateOrUpdateGlobalTwitchChannelArgs, TwitchChannelWithLatestInfo, CreateOrUpdateStreamerYoutubeChannelArgs, CreateOrUpdateStreamerTwitchChannelArgs } from '@rebel/server/stores/ChannelStore'
import CustomEmojiService from '@rebel/server/services/CustomEmojiService'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import EventDispatchService, { EVENT_CHAT_ITEM, EVENT_CHAT_ITEM_REMOVED } from '@rebel/server/services/EventDispatchService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import CommandService from '@rebel/server/services/command/CommandService'
import CommandStore from '@rebel/server/stores/CommandStore'
import { ChatMessage } from '@prisma/client'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import ChannelEventService from '@rebel/server/services/ChannelEventService'

type ChatEvents = {
  newChatItem: {
    item: ChatItem
  }
}

type Deps = Dependencies<{
  chatStore: ChatStore,
  logService: LogService,
  experienceService: ExperienceService,
  channelStore: ChannelStore,
  customEmojiService: CustomEmojiService,
  eventDispatchService: EventDispatchService
  livestreamStore: LivestreamStore
  commandService: CommandService
  commandHelpers: CommandHelpers
  commandStore: CommandStore
  channelEventService: ChannelEventService
}>

export default class ChatService extends ContextClass {
  readonly name = ChatService.name
  private readonly chatStore: ChatStore
  private readonly logService: LogService
  private readonly experienceService: ExperienceService
  private readonly channelStore: ChannelStore
  private readonly customEmojiService: CustomEmojiService
  private readonly eventDispatchService: EventDispatchService
  private readonly livestreamStore: LivestreamStore
  private readonly commandHelpers: CommandHelpers
  private readonly commandService: CommandService
  private readonly commandStore: CommandStore
  private readonly channelEventService: ChannelEventService

  constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.logService = deps.resolve('logService')
    this.experienceService = deps.resolve('experienceService')
    this.channelStore = deps.resolve('channelStore')
    this.customEmojiService = deps.resolve('customEmojiService')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.commandHelpers = deps.resolve('commandHelpers')
    this.commandService = deps.resolve('commandService')
    this.commandStore = deps.resolve('commandStore')
    this.channelEventService = deps.resolve('channelEventService')
  }

  public override initialise () {
    this.eventDispatchService.onData(EVENT_CHAT_ITEM, data => this.onNewChatItem(data, data.streamerId))
    this.eventDispatchService.onData(EVENT_CHAT_ITEM_REMOVED, data => this.onChatItemRemoved(data.externalMessageId))
  }

  /** Returns ordered chat items (from earliest to latest) that may or may not be from the current livestream.
   * If `deletedOnly` is not provided, returns only active chat messages. If true, returns only deleted messages since the given time (respecting all other provided filters). */
  public async getChatSince (streamerId: number, since: number, beforeOrAt?: number, limit?: number, userIds?: number[], deletedOnly?: boolean): Promise<ChatItemWithRelations[]> {
    const chatItems = await this.chatStore.getChatSince(streamerId, since, beforeOrAt, limit, userIds, deletedOnly)
    await Promise.all(chatItems.map(item => this.customEmojiService.signEmojiImages(item.chatMessageParts)))
    return chatItems
  }

  public async onChatItemRemoved (externalMessageId: string) {
    try {
      const isRemoved = await this.chatStore.removeChat(externalMessageId)
      this.logService.logInfo(this, `Removed chat item ${externalMessageId}: ${isRemoved}`)
    } catch (e: any) {
      this.logService.logError(this, `Failed to remove chat item ${externalMessageId}:`, e)
    }
  }

  /** Returns true if the chat item was new and added to the DB, and false if it wasn't because it already existed. Throws if something went wrong while adding the chat item. */
  public async onNewChatItem (item: ChatItem, streamerId: number): Promise<boolean> {
    let message: ChatMessage | null = null
    let channel: YoutubeChannelWithLatestInfo | TwitchChannelWithLatestInfo
    let externalId: string
    let platform: ChatPlatform
    try {
      if (item.platform === 'youtube') {
        const channelInfo: CreateOrUpdateGlobalYoutubeChannelArgs & CreateOrUpdateStreamerYoutubeChannelArgs = {
          name: item.author.name ?? '',
          time: new Date(item.timestamp),
          streamerId: streamerId,
          imageUrl: item.author.image,
          isOwner: item.author.attributes.isOwner,
          isModerator: item.author.attributes.isModerator,
          isVerified: item.author.attributes.isVerified,
        }
        externalId = item.author.channelId
        platform = 'youtube'
        channel = await this.channelStore.createOrUpdateYoutubeChannel(externalId, channelInfo)

        await this.channelEventService.checkYoutubeChannelForModEvent(streamerId, channel.id)

      } else if (item.platform === 'twitch') {
        const channelInfo: CreateOrUpdateGlobalTwitchChannelArgs & CreateOrUpdateStreamerTwitchChannelArgs = {
          userName: item.author.userName,
          displayName: item.author.displayName,
          time: new Date(item.timestamp),
          streamerId: streamerId,
          userType: item.author.userType ?? '',
          colour: item.author.color ?? '',
          isBroadcaster: item.author.isBroadcaster,
          isMod: item.author.isMod,
          isSubscriber: item.author.isSubscriber,
          isVip: item.author.isVip
        }
        externalId = item.author.userId
        platform = 'twitch'
        channel = await this.channelStore.createOrUpdateTwitchChannel(externalId, channelInfo)

      } else {
        assertUnreachable(item)
      }

      // inject custom emojis
      const splitParts = await Promise.all(item.messageParts.map(part => this.customEmojiService.applyCustomEmojis(part, channel.userId, streamerId)))
      item.messageParts = splitParts.flatMap(p => p)

      // there is a known issue where, since we are adding the chat in a separate transaction than the experience, it
      // is possible that calling the GET /chat endpoint returns the level information that does not yet incorporate the
      // experience gained due to the latest chat - see CHAT-166. we could add a flag that indicates that a chat item's side
      // effects have not yet been completed, but honestly that adds a lot of complexity for a small, temporary, unimportant
      // visual inconsitency. so for now just acknowledge this and leave it.
      message = await this.chatStore.addChat(item, streamerId, channel.userId, externalId)

    } catch (e: any) {
      this.logService.logError(this, 'Failed to add chat.', e)
      throw e
    }

    const command = this.commandHelpers.extractNormalisedCommand(item.messageParts)

    // either perform side effects for a normal message, or execute command for a chat command message
    if (message != null && command == null) {
      try {
        const [youtubeLivestream, twitchLivestream] = await Promise.all([
          this.livestreamStore.getActiveYoutubeLivestream(streamerId),
          this.livestreamStore.getCurrentTwitchLivestream(streamerId)
        ])

        if (youtubeLivestream != null || twitchLivestream != null) {
          await this.experienceService.addExperienceForChat(item, streamerId)
        }
      } catch (e: any) {
        this.logService.logError(this, `Successfully added ${platform!} chat item ${item.id} but failed to complete side effects.`, e)
      }

    } else if (message != null && command != null) {
      try {
        const id = await this.commandStore.addCommand(message.id, command)
        this.commandService.queueCommandExecution(id)
      } catch (e: any) {
        this.logService.logError(this, `Successfully added ${platform!} chat item ${item.id} but failed to handle the command represented by the message.`, e)
      }
    }

    const addedChat = message != null
    return addedChat
  }
}
