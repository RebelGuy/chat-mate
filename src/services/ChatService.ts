
import { Dependencies } from '@rebel/context/ContextProvider'
import MasterchatFactory from '@rebel/factories/MasterchatFactory'
import ChatStore from '@rebel/stores/ChatStore'
import { Action, AddChatItemAction, Masterchat, YTRun, YTTextRun } from "masterchat"
import { ChatItem, getChatText, PartialChatMessage } from "@rebel/models/chat"
import { isList, List } from 'immutable'
import { clamp, clampNormFn, sum } from '@rebel/util'

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

export default class ChatService {
  private readonly chatStore: ChatStore

  // note: there is a bug where the "live chat" (as opposed to "top chat") option doesn't work, so any
  // messages that might be spammy/inappropriate will not show up.
  private readonly chat: Masterchat

  private listeners: Map<keyof ChatEvents, ((data: any) => void)[]> = new Map()
  private timeout: NodeJS.Timeout | null = null

  constructor (deps: Dependencies) {
    this.chatStore = deps.resolve<ChatStore>(ChatStore.name)
    this.chat = deps.resolve<MasterchatFactory>(MasterchatFactory.name).create()

    this.start()
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
    const token = this.chatStore.continuationToken
    try {
      return token ? await this.chat.fetch(token) : await this.chat.fetch()
    } catch (e: any) {
      console.log('Fetch failed:', e.message)
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
        console.warn(`Fetched ${chatItems.length} new chat items but continuation token is null. Ignoring chat items.`)
      } else {
        const token = response.continuation.token
        this.chatStore.addChat(token, chatItems)
        hasNewChat = chatItems.length > 0
      }
    }

    // if we received a new message, immediately start checking for another one
    const nextInterval = hasNewChat ? MIN_INTERVAL : getNextInterval(new Date().getTime(), this.chatStore.chatItems.map(c => c.timestamp))
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
          name: run.emoji.image.accessibility!.accessibilityData.label,
          label: run.emoji.shortcuts[0] ?? run.emoji.searchTerms[0],
          image: run.emoji.image.thumbnails[0]!
        }
      }
    })

    return {
      internalId: 0, // todo
      id: item.id,
      timestamp: item.timestamp.getTime(),
      author: {
        internalId: 0, // todo
        name: item.authorName,
        channelId: item.authorChannelId,
        image: item.authorPhoto,
        attributes: {
          isOwner: item.isOwner,
          isModerator: item.isModerator,
          isVerified: item.isVerified
        }
      },
      messageParts,
      renderedText: getChatText(messageParts)
    }
  }
}

function isTextRun (run: YTRun): run is YTTextRun {
  return (run as any).emoji == null
}

function isAddChatAction (action: Action): action is AddChatItemAction {
  return action.type === 'addChatItemAction'
}

function getNextInterval (currentTime: number, timestamps: List<number> | number[]): number {
  if (!isList(timestamps)) {
    timestamps = List(timestamps)
  }

  const startTimestamp = currentTime - LIMIT

  const weightFn = clampNormFn(t => Math.sqrt(t), startTimestamp, currentTime)
  const weights = timestamps.filter(t => t >= startTimestamp).map(t => weightFn(t))
  console.log('weights', weights.toArray())

  // pretend each message was the only one sent in the period, and scale the average based on the weight. then add all.
  // this has the effect that, if there is a quick burst of messages, it won't increase the refresh rate for the whole
  // `limit` interval, but smoothly return back to normal over time.
  const chatRate = sum(weights.map(w => w / (LIMIT / 1000)))
  console.log('chatRate', chatRate)

  const nextInterval = (1 - clamp(0, (chatRate - MIN_CHAT_RATE) / (MAX_CHAT_RATE - MIN_CHAT_RATE), 1)) * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL
  console.log(nextInterval)
  return nextInterval
}
