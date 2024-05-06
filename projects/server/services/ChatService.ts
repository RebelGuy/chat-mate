
import { Dependencies } from '@rebel/shared/context/context'
import ChatStore, { AddedChatMessage } from '@rebel/server/stores/ChatStore'
import { ChatItem, ChatItemWithRelations, ChatPlatform } from '@rebel/server/models/chat'
import LogService, {  } from '@rebel/server/services/LogService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ContextClass from '@rebel/shared/context/ContextClass'
import ChannelStore, { YoutubeChannelWithLatestInfo, CreateOrUpdateGlobalYoutubeChannelArgs, CreateOrUpdateGlobalTwitchChannelArgs, TwitchChannelWithLatestInfo, CreateOrUpdateStreamerYoutubeChannelArgs, CreateOrUpdateStreamerTwitchChannelArgs } from '@rebel/server/stores/ChannelStore'
import CustomEmojiService from '@rebel/server/services/CustomEmojiService'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import EventDispatchService, { EVENT_CHAT_ITEM, EVENT_CHAT_ITEM_REMOVED, EVENT_PUBLIC_CHAT_ITEM, EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER } from '@rebel/server/services/EventDispatchService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import CommandService from '@rebel/server/services/command/CommandService'
import CommandStore from '@rebel/server/stores/CommandStore'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import ChannelEventService from '@rebel/server/services/ChannelEventService'
import EmojiService from '@rebel/server/services/EmojiService'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import { single } from '@rebel/shared/util/arrays'

export const INACCESSIBLE_EMOJI = '__INACCESSIBLE_EMOJI__'

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
  emojiService: EmojiService
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
  private readonly emojiService: EmojiService

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
    this.emojiService = deps.resolve('emojiService')
  }

  public override initialise () {
    this.eventDispatchService.onData(EVENT_CHAT_ITEM, data => this.onNewChatItem(data, data.streamerId))
    this.eventDispatchService.onData(EVENT_CHAT_ITEM_REMOVED, data => this.onChatItemDeleted(data.externalMessageId))
  }

  public async getChatById (chatMessageId: number) {
    let chatItem = await this.chatStore.getChatById(chatMessageId)
    await this.customEmojiService.signEmojiImages(chatItem.chatMessageParts)

    if (chatItem.chatMessageParts.find(p => p.emoji != null || p.customEmoji?.emoji != null)) {
      const eligibleEmojiUserIds = await this.emojiService.getEligibleEmojiUsers(chatItem.streamerId)
      const primaryUserId = getPrimaryUserId(chatItem.user!)

      if (eligibleEmojiUserIds.includes(primaryUserId)) {
        await this.emojiService.signEmojiImages(chatItem.chatMessageParts)
      } else {
        chatItem.chatMessageParts.forEach(part => {
          if (part.emoji != null) {
            part.emoji.imageUrl = INACCESSIBLE_EMOJI
            part.emoji.image.fingerprint = INACCESSIBLE_EMOJI
            part.emoji.image.originalUrl = INACCESSIBLE_EMOJI
            part.emoji.image.url = INACCESSIBLE_EMOJI
          } else if (part.customEmoji?.emoji != null) {
            part.customEmoji.emoji.imageUrl = INACCESSIBLE_EMOJI
            part.customEmoji.emoji.image.fingerprint = INACCESSIBLE_EMOJI
            part.customEmoji.emoji.image.originalUrl = INACCESSIBLE_EMOJI
            part.customEmoji.emoji.image.url = INACCESSIBLE_EMOJI
          }
        })
      }
    }

    return chatItem
  }

  /** Returns ordered chat items (from earliest to latest) that may or may not be from the current livestream.
   * If `deletedOnly` is not provided, returns only active chat messages. If true, returns only deleted messages since the given time (respecting all other provided filters). */
  public async getChatSince (streamerId: number, since: number, beforeOrAt?: number, limit?: number, userIds?: number[], deletedOnly?: boolean): Promise<ChatItemWithRelations[]> {
    let chatItems = await this.chatStore.getChatSince(streamerId, since, beforeOrAt, limit, userIds, deletedOnly)
    await Promise.all(chatItems.map(item => this.customEmojiService.signEmojiImages(item.chatMessageParts)))

    // if there are emojis, make sure we return emoji info only for eligible users' messages
    if (chatItems.some(c => c.chatMessageParts.find(p => p.emoji != null || p.customEmoji?.emoji != null))) {
      const eligibleEmojiUserIds = await this.emojiService.getEligibleEmojiUsers(streamerId)

      chatItems.forEach(item => {
        const primaryUserId = getPrimaryUserId(item.user!)
        if (!eligibleEmojiUserIds.includes(primaryUserId)) {
          item.chatMessageParts.forEach(part => {
            if (part.emoji != null) {
              part.emoji.imageUrl = INACCESSIBLE_EMOJI
              part.emoji.image.fingerprint = INACCESSIBLE_EMOJI
              part.emoji.image.originalUrl = INACCESSIBLE_EMOJI
              part.emoji.image.url = INACCESSIBLE_EMOJI
            } else if (part.customEmoji?.emoji != null) {
              part.customEmoji.emoji.imageUrl = INACCESSIBLE_EMOJI
              part.customEmoji.emoji.image.fingerprint = INACCESSIBLE_EMOJI
              part.customEmoji.emoji.image.originalUrl = INACCESSIBLE_EMOJI
              part.customEmoji.emoji.image.url = INACCESSIBLE_EMOJI
            }
          })
        }
      })

      await Promise.all(chatItems.map(item => this.emojiService.signEmojiImages(item.chatMessageParts)))
    }

    return chatItems
  }

  public async onChatItemDeleted (externalMessageId: string) {
    try {
      const removedMessage = await this.chatStore.deleteChat(externalMessageId)
      this.logService.logInfo(this, `Deleted chat item ${externalMessageId}: ${removedMessage != null}`)

      if (removedMessage) {
        void this.eventDispatchService.addData(EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, { streamerId: removedMessage.streamerId, chatMessageId: removedMessage.id })
      }
    } catch (e: any) {
      this.logService.logError(this, `Failed to delete chat item ${externalMessageId}:`, e)
    }
  }

  /** Returns true if the chat item was new and added to the DB, and false if it wasn't because it already existed. Throws if something went wrong while adding the chat item. */
  public async onNewChatItem (item: ChatItem, streamerId: number): Promise<boolean> {
    let message: AddedChatMessage | null = null
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

      // process public emojis (this will replace all PartialEmojiChatMessage with PartialProcessEmojiChatMessage)
      item.messageParts = await Promise.all(item.messageParts.map(part => this.emojiService.processEmoji(part)))

      // there is a known issue where, since we are adding the chat in a separate transaction than the experience, it
      // is possible that calling the GET /chat endpoint returns the level information that does not yet incorporate the
      // experience gained due to the latest chat - see CHAT-166. we could add a flag that indicates that a chat item's side
      // effects have not yet been completed, but honestly that adds a lot of complexity for a small, temporary, unimportant
      // visual inconsitency. so for now just acknowledge this and leave it.
      message = await this.chatStore.addChat(item, streamerId, channel.userId, externalId)

      // send events
      if (message != null) {
        const primaryUserId = getPrimaryUserId(message.user)
        const firstChat = await this.chatStore.getTimeOfFirstChat(streamerId, [primaryUserId]).then(single)
        if (firstChat.messageId === message.id) {
          void this.eventDispatchService.addData(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER, { streamerId, primaryUserId })
        }

        void this.eventDispatchService.addData(EVENT_PUBLIC_CHAT_ITEM, message)
      }
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
