
import { PartialProcessedEmojiChatMessage, ytEmojiToPartialEmojiChatMessage } from '@rebel/server/models/chat'
import EmojiService from '@rebel/server/services/EmojiService'
import EventDispatchService, { EVENT_PUBLIC_CHAT_MATE_EVENT_LIVE_REACTION } from '@rebel/server/services/EventDispatchService'
import LogService from '@rebel/server/services/LogService'
import LiveReactionStore from '@rebel/server/stores/LiveReactionStore'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  eventDispatchService: EventDispatchService
  emojiService: EmojiService
  liveReactionStore: LiveReactionStore
  logService: LogService
}>

// if you can't see the reaction button while testing, it may be hidden: document.getElementById('reaction-control-panel').removeAttribute('hidden')

export default class LiveReactionService extends SingletonContextClass {
  public readonly name = LiveReactionService.name

  private readonly eventDispatchService: EventDispatchService
  private readonly emojiService: EmojiService
  private readonly liveReactionStore: LiveReactionStore
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()

    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.emojiService = deps.resolve('emojiService')
    this.liveReactionStore = deps.resolve('liveReactionStore')
    this.logService = deps.resolve('logService')
  }

  public async onLiveReaction (streamerId: number, reactionUnicodeEmoji: any, reactionCount: number) {
    try {
      const ytEmoji = this.emojiService.parseEmojiByUnicode(reactionUnicodeEmoji)
      if (ytEmoji == null) {
        return
      }

      const chatMessage = ytEmojiToPartialEmojiChatMessage(ytEmoji)
      const processedMessage = await this.emojiService.processEmoji(chatMessage) as PartialProcessedEmojiChatMessage
      const emojiId = processedMessage.emojiId

      await this.liveReactionStore.addLiveReaction(streamerId, emojiId, reactionCount)
      await this.eventDispatchService.addData(EVENT_PUBLIC_CHAT_MATE_EVENT_LIVE_REACTION, { streamerId, emojiId, reactionCount })
    } catch (e: any) {
      this.logService.logError(this, `Unable to process live reaction for streamer ${streamerId}:`, e)
    }
  }
}
