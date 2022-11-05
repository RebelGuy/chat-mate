import { Dependencies } from '@rebel/server/context/context'
import ChatStore from '@rebel/server/stores/ChatStore'
import { Action, AddChatItemAction, YTRun, YTTextRun } from '@rebel/masterchat'
import { ChatItem, getEmojiLabel, getUniqueEmojiId, PartialChatMessage } from '@rebel/server/models/chat'
import { isList, List } from 'immutable'
import { clamp, clampNormFn, sum } from '@rebel/server/util/math'
import LogService, { createLogContext, LogContext } from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import ContextClass from '@rebel/server/context/ContextClass'
import ChatService from '@rebel/server/services/ChatService'
import { Livestream } from '@prisma/client'

const MIN_INTERVAL = 500
const MAX_INTERVAL = 3_000

// this can approximately be interpreted as the number of chat messages per minute
const MIN_CHAT_RATE = 0.5 / 60
const MAX_CHAT_RATE = 10 / 60

// how far back we will look to determine the dynamic refresh rates
const LIMIT = 120_000

type Deps = Dependencies<{
  chatService: ChatService,
  chatStore: ChatStore,
  logService: LogService,
  masterchatProxyService: MasterchatProxyService,
  timerHelpers: TimerHelpers,
  livestreamStore: LivestreamStore,
  disableExternalApis: boolean
}>

export default class ChatFetchService extends ContextClass {
  readonly name = ChatFetchService.name
  private readonly chatService: ChatService
  private readonly chatStore: ChatStore
  private readonly logService: LogService
  private readonly masterchatProxyService: MasterchatProxyService
  private readonly timerHelpers: TimerHelpers
  private readonly livestreamStore: LivestreamStore
  private readonly disableExternalApis: boolean

  constructor (deps: Deps) {
    super()
    this.chatService = deps.resolve('chatService')
    this.chatStore = deps.resolve('chatStore')
    this.masterchatProxyService = deps.resolve('masterchatProxyService')
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.disableExternalApis = deps.resolve('disableExternalApis')
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    const timerOptions: TimerOptions = {
      behaviour: 'dynamicEnd',
      callback: this.updateMessages
    }
    await this.timerHelpers.createRepeatingTimer(timerOptions, true)
  }

  private fetchLatest = async (livestream: Livestream) => {
    const token = livestream.continuationToken
    const liveId = livestream.liveId

    try {
      const result = await this.masterchatProxyService.fetch(liveId, token ?? undefined)
      return result
    } catch (e: any) {
      this.logService.logWarning(this, 'Encountered error while fetching chat:', e.message)
      await this.livestreamStore.setContinuationToken(liveId, null)
      return null
    }
  }

  private updateMessages = async () => {
    // todo: CHAT-479 attach streamerId to livestream
    const livestream = await this.livestreamStore.getActiveLivestream()
    const streamerId = 1
    if (livestream == null) {
      return MAX_INTERVAL
    }

    const response = await this.fetchLatest(livestream)

    let hasNewChat: boolean = false
    if (response != null) {
      let chatItems = response.actions
        .filter(action => isAddChatAction(action))
        .map(item => this.toChatItem(item as AddChatItemAction))
        .sort((c1, c2) => c1.timestamp - c2.timestamp)

      if (response.continuation?.token == null) {
        this.logService.logWarning(this, `Fetched ${chatItems.length} new chat items but continuation token is null. Ignoring chat items.`)
      } else {
        this.logService.logInfo(this, `Adding ${chatItems.length} new chat items`)

        let anyFailed = false
        for (const item of chatItems) {
          const success = await this.chatService.onNewChatItem(item, streamerId)
          if (success) {
            hasNewChat = true
          } else {
            anyFailed = true
          }
        }

        if (!anyFailed) {
          // purposefully only set this AFTER everything has been added. if we set it before,
          // and something goes wrong with adding chat, the chat messages will be lost forever.
          // todo: maybe we want it to be lost forever - perhaps there was bad data in the chat message, and now we are stuck in an infinite loop...
          await this.livestreamStore.setContinuationToken(livestream.liveId, response.continuation.token)
        }
      }
    }

    // if we received a new message, immediately start checking for another one
    if (hasNewChat) {
      return MIN_INTERVAL
    } else {
      const now = Date.now()
      const chat = await this.chatStore.getChatSince(now - LIMIT)
      const timestamps = chat.map(c => c.time.getTime())
      return getNextInterval(now, timestamps, createLogContext(this.logService, this))
    }
  }

  private toChatItem (item: AddChatItemAction): ChatItem {
    const messageParts = item.message!.map((run: YTRun): PartialChatMessage => {
      if (isTextRun(run)) {
        return {
          type: 'text',
          text: run.text,
          isBold: run.bold ?? false,
          isItalics: run.italics ?? false
        }
      } else {
        return {
          type: 'emoji',
          emojiId: getUniqueEmojiId(run.emoji),
          name: run.emoji.image.accessibility!.accessibilityData.label,
          label: getEmojiLabel(run.emoji),
          image: run.emoji.image.thumbnails[0]!
        }
      }
    })

    return {
      id: item.id,
      timestamp: item.timestamp.getTime(),
      platform: 'youtube',
      contextToken: item.contextMenuEndpointParams,
      author: {
        name: item.authorName,
        channelId: item.authorChannelId,
        image: item.authorPhoto,
        attributes: {
          isOwner: item.isOwner,
          isModerator: item.isModerator,
          isVerified: item.isVerified
        }
      },
      messageParts
    }
  }
}

function isTextRun (run: YTRun): run is YTTextRun {
  return (run as any).emoji == null
}

function isAddChatAction (action: Action): action is AddChatItemAction {
  return action.type === 'addChatItemAction' && (action.message?.length ?? 0) > 0
}

function getNextInterval (currentTime: number, timestamps: List<number> | number[], logContext: LogContext): number {
  if (!isList(timestamps)) {
    timestamps = List(timestamps)
  }

  const startTimestamp = currentTime - LIMIT

  const weightFn = clampNormFn(t => Math.sqrt(t), startTimestamp, currentTime)
  const weights = timestamps.filter(t => t >= startTimestamp).map(t => weightFn(t))

  // pretend each message was the only one sent in the period, and scale the average based on the weight. then add all.
  // this has the effect that, if there is a quick burst of messages, it won't increase the refresh rate for the whole
  // `limit` interval, but smoothly return back to normal over time.
  const chatRate = sum(weights.map(w => w / (LIMIT / 1000)))
  const nextInterval = (1 - clamp((chatRate - MIN_CHAT_RATE) / (MAX_CHAT_RATE - MIN_CHAT_RATE), 0, 1)) * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL

  logContext.logDebug(`Chat rate: ${chatRate.toFixed(4)} | Next interval: ${nextInterval.toFixed(0)}`)
  return nextInterval
}
