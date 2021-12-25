
import { Dependencies } from '@rebel/server/context/context'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import ChatStore from '@rebel/server/stores/ChatStore'
import { Action, AddChatItemAction, YTRun, YTTextRun } from "@rebel/masterchat"
import { ChatItem, getEmojiLabel, getUniqueEmojiId, PartialChatMessage } from "@rebel/server/models/chat"
import { isList, List } from 'immutable'
import { clamp, clampNormFn, sum } from '@rebel/server/util/math'
import { IMasterchat } from '@rebel/server/interfaces'
import LogService, { createLogContext, LogContext } from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'

const MIN_INTERVAL = 500
const MAX_INTERVAL = 6_000

// this can approximately be interpreted as the number of chat messages per minute
const MIN_CHAT_RATE = 0.5 / 60
const MAX_CHAT_RATE = 10 / 60

// how far back we will look to determine the dynamic refresh rates
const LIMIT = 120_000

type ChatEvents = {
  newChatItem: {
    item: ChatItem
  }
}

type Deps = Dependencies<{
  chatStore: ChatStore,
  livestreamStore: LivestreamStore,
  logService: LogService,
  masterchatProvider: MasterchatProvider
}>

export default class ChatService {
  readonly name = ChatService.name
  private readonly chatStore: ChatStore
  private readonly livestreamStore: LivestreamStore
  private readonly logService: LogService
  private readonly masterchat: IMasterchat

  private listeners: Map<keyof ChatEvents, ((data: any) => void)[]> = new Map()
  private timeout: NodeJS.Timeout | null = null

  constructor (deps: Deps) {
    this.chatStore = deps.resolve('chatStore')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchat = deps.resolve('masterchatProvider').get()
    this.logService = deps.resolve('logService')
  }

  start () {
    if (this.timeout) {
      return
    }

    this.updateMessages()
  }

  stop () {
    if (!this.timeout) {
      return
    }

    clearTimeout(this.timeout)
  }

  on<E extends keyof ChatEvents> (type: E, callback: (data: ChatEvents[E]) => void) {
    let listeners = this.listeners.get(type) ?? []
    listeners.push(callback)
  }

  off<E extends keyof ChatEvents> (type: E, callback: (data: ChatEvents[E]) => void) {
    let listeners = this.listeners.get(type) ?? []
    this.listeners.set(type, listeners.filter(cb => cb !== callback))
  }

  private fetchLatest = async () => {
    const token = this.livestreamStore.currentLivestream.continuationToken
    try {
      const result = token ? await this.masterchat.fetch(token) : await this.masterchat.fetch()
      this.logService.logApi(this, 'masterchat.fetch', { chatToken: token }, result)
      return result
    } catch (e: any) {
      this.logService.logWarning(this, 'Fetch failed:', e.message)
      await this.livestreamStore.setContinuationToken(null)
      return null
    }
  }

  private updateMessages = async () => {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    const response = await this.fetchLatest()

    let hasNewChat: boolean = false
    if (response != null) {
      const chatItems = response.actions
        .filter(action => isAddChatAction(action))
        .map(item => this.toChatItem(item as AddChatItemAction))

      if (response.continuation?.token == null) {
        this.logService.logWarning(this, `Fetched ${chatItems.length} new chat items but continuation token is null. Ignoring chat items.`)
      } else {
        const token = response.continuation.token
        await this.chatStore.addChat(token, chatItems)
        hasNewChat = chatItems.length > 0
      }
    }

    // if we received a new message, immediately start checking for another one
    let nextInterval
    if (hasNewChat) {
      nextInterval = MIN_INTERVAL
    } else {
      const now = Date.now()
      const chat = await this.chatStore.getChatSince(now - LIMIT)
      const timestamps = chat.map(c => c.time.getTime())
      nextInterval = getNextInterval(now, timestamps, createLogContext(this.logService, this))
    }
    this.timeout = setTimeout(this.updateMessages, nextInterval)
  }

  private toChatItem (item: AddChatItemAction): ChatItem {
    const messageParts = item.message.map((run: YTRun): PartialChatMessage => {
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
  return action.type === 'addChatItemAction'
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
  const nextInterval = (1 - clamp(0, (chatRate - MIN_CHAT_RATE) / (MAX_CHAT_RATE - MIN_CHAT_RATE), 1)) * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL

  logContext.logDebug(`Chat rate: ${chatRate.toFixed(4)} | Next interval: ${nextInterval.toFixed(0)}`)
  return nextInterval
}
