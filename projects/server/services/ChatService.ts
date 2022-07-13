
import { Dependencies } from '@rebel/server/context/context'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ChatItem, ChatPlatform } from '@rebel/server/models/chat'
import LogService, {  } from '@rebel/server/services/LogService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import ContextClass from '@rebel/server/context/ContextClass'
import ChannelStore, { YoutubeChannelWithLatestInfo, CreateOrUpdateYoutubeChannelArgs, CreateOrUpdateTwitchChannelArgs, TwitchChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import EmojiService from '@rebel/server/services/EmojiService'
import { assertUnreachable } from '@rebel/server/util/typescript'
import EventDispatchService from '@rebel/server/services/EventDispatchService'

type ChatEvents = {
  newChatItem: {
    item: ChatItem
  }
}

type Deps = Dependencies<{
  chatStore: ChatStore,
  logService: LogService,
  experienceService: ExperienceService,
  viewershipStore: ViewershipStore,
  channelStore: ChannelStore,
  emojiService: EmojiService,
  eventDispatchService: EventDispatchService
}>

export default class ChatService extends ContextClass {
  readonly name = ChatService.name
  private readonly chatStore: ChatStore
  private readonly logService: LogService
  private readonly experienceService: ExperienceService
  private readonly viewershipStore: ViewershipStore
  private readonly channelStore: ChannelStore
  private readonly emojiService: EmojiService
  private readonly eventDispatchService: EventDispatchService

  constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.logService = deps.resolve('logService')
    this.experienceService = deps.resolve('experienceService')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.channelStore = deps.resolve('channelStore')
    this.emojiService = deps.resolve('emojiService')
    this.eventDispatchService = deps.resolve('eventDispatchService')
  }

  public override initialise () {
    this.eventDispatchService.onData('chatItem', data => this.onNewChatItem(data))
  }

  /** Returns true if the chat item was successfully added (regardless of whether side effects completed successfully or not). */
  public async onNewChatItem (item: ChatItem): Promise<boolean> {
    let addedChat: boolean = false
    let channel: YoutubeChannelWithLatestInfo | TwitchChannelWithLatestInfo
    let externalId: string
    let platform: ChatPlatform
    try {
      if (item.platform === 'youtube') {
        const channelInfo: CreateOrUpdateYoutubeChannelArgs = {
          name: item.author.name ?? '',
          time: new Date(item.timestamp),
          imageUrl: item.author.image,
          isOwner: item.author.attributes.isOwner,
          isModerator: item.author.attributes.isModerator,
          isVerified: item.author.attributes.isVerified
        }
        externalId = item.author.channelId
        platform = 'youtube'
        channel = await this.channelStore.createOrUpdate('youtube', externalId, channelInfo)

      } else if (item.platform === 'twitch') {
        const channelInfo: CreateOrUpdateTwitchChannelArgs = {
          userName: item.author.userName,
          displayName: item.author.displayName,
          time: new Date(item.timestamp),
          userType: item.author.userType ?? '',
          colour: item.author.color ?? '',
          isBroadcaster: item.author.isBroadcaster,
          isMod: item.author.isMod,
          isSubscriber: item.author.isSubscriber,
          isVip: item.author.isVip
        }
        externalId = item.author.userId
        platform = 'twitch'
        channel = await this.channelStore.createOrUpdate('twitch', externalId, channelInfo)

      } else {
        assertUnreachable(item)
      }

      // inject custom emojis
      const splitParts = await Promise.all(item.messageParts.map(part => this.emojiService.applyCustomEmojis(part, channel.userId)))
      item.messageParts = splitParts.flatMap(p => p)

      // there is a known issue where, since we are adding the chat in a separate transaction than the experience, it
      // is possible that calling the GET /chat endpoint returns the level information that does not yet incorporate the
      // experience gained due to the latest chat - see CHAT-166. we could add a flag that indicates that a chat item's side
      // effects have not yet been completed, but honestly that adds a lot of complexity for a small, temporary, unimportant
      // visual inconsitency. so for now just acknowledge this and leave it.
      await this.chatStore.addChat(item, channel.userId, externalId)
      addedChat = true
    } catch (e: any) {
      this.logService.logError(this, 'Failed to add chat.', e)
    }

    if (addedChat) {
      try {
        await this.viewershipStore.addViewershipForChatParticipation(channel!.userId, item.timestamp)
        await this.experienceService.addExperienceForChat(item)
      } catch (e: any) {
        this.logService.logError(this, `Successfully added ${platform!} chat item ${item.id} but failed to complete side effects.`, e)
      }
    }

    return addedChat
  }
}
