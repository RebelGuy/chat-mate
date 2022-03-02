
import { Dependencies } from '@rebel/server/context/context'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ChatItem } from '@rebel/server/models/chat'
import LogService, {  } from '@rebel/server/services/LogService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import ContextClass from '@rebel/server/context/ContextClass'
import ChannelStore, { CreateOrUpdateChannelArgs } from '@rebel/server/stores/ChannelStore'

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
  channelStore: ChannelStore
}>

export default class ChatService extends ContextClass {
  readonly name = ChatService.name
  private readonly chatStore: ChatStore
  private readonly logService: LogService
  private readonly experienceService: ExperienceService
  private readonly viewershipStore: ViewershipStore
  private readonly channelStore: ChannelStore

  constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.logService = deps.resolve('logService')
    this.experienceService = deps.resolve('experienceService')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.channelStore = deps.resolve('channelStore')
  }

  /** Returns true if the chat item was successfully added. */
  public async onNewChatItem (item: ChatItem): Promise<boolean> {
    let addedChat: boolean = false
    try {
      const channelInfo: CreateOrUpdateChannelArgs = {
        name: item.author.name ?? '',
        time: new Date(item.timestamp),
        imageUrl: item.author.image,
        isOwner: item.author.attributes.isOwner,
        isModerator: item.author.attributes.isModerator,
        IsVerified: item.author.attributes.isVerified
      }
      const channel = await this.channelStore.createOrUpdate(item.author.channelId, channelInfo)  

      // todo:
      // item.messageParts = item.messageParts.flatMap(part => this.emojiService.applyCustomEmojis(part, channel.id))

      // there is a known issue where, since we are adding the chat in a separate transaction than the experience, it
      // is possible that calling the GET /chat endpoint returns the level information that does not yet incorporate the
      // experience gained due to the latest chat - see CHAT-166. we could add a flag that indicates that a chat item's side
      // effects have not yet been completed, but honestly that adds a lot of complexity for a small, temporary, unimportant
      // visual inconsitency. so for now just acknowledge this and leave it.
      await this.chatStore.addChat(item, channel.id)
      addedChat = true
    } catch (e: any) {
      this.logService.logError(this, 'Failed to add chat.', e)
    }

    if (addedChat) {
      try {
        const channelId = await this.channelStore.getId(item.author.channelId)
        await this.viewershipStore.addViewershipForChatParticipation(channelId, item.timestamp)
        await this.experienceService.addExperienceForChat(item)
      } catch (e: any) {
        this.logService.logError(this, `Successfully added chat item ${item.id} but failed to complete side effects.`, e)
      }
    }

    return addedChat
  }
}
