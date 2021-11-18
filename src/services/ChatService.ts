
import { Dependencies } from '@rebel/context/ContextProvider'
import MasterchatFactory from '@rebel/factories/MasterchatFactory'
import ChatStore from '@rebel/stores/ChatStore'
import { Action, AddChatItemAction, Masterchat, stringify, YTEmojiRun, YTRun, YTTextRun } from "masterchat"
import { ChatItem, getChatText, PartialChatMessage, PartialTextChatMessage } from "@rebel/models/chat"

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
  private interval: NodeJS.Timer | null = null

  constructor (deps: Dependencies) {
    this.chatStore = deps.resolve<ChatStore>(ChatStore.name)
    this.chat = deps.resolve<MasterchatFactory>(MasterchatFactory.name).create()

    this.start()
  }

  start () {
    if (this.interval) {
      return
    }

    // todo: can add dynamic timeout that adjusts for busy periods, up to twice per second
    this.interval = setInterval(() => this.updateMessages(), 2000)
    this.updateMessages()
  }

  stop () {
    if (!this.interval) {
      return
    }

    clearInterval(this.interval)
  }

  on<E extends keyof ChatEvents> (type: E, callback: (data: ChatEvents[E]) => void) {
    let listeners = this.listeners.get(type) ?? []
    listeners.push(callback)
  }

  off<E extends keyof ChatEvents> (type: E, callback: (data: ChatEvents[E]) => void) {
    let listeners = this.listeners.get(type) ?? []
    this.listeners.set(type, listeners.filter(cb => cb !== callback))
  }

  private fetchLatest = () => {
    const token = this.chatStore.continuationToken
    return token ? this.chat.fetch(token) : this.chat.fetch()
  }

  private updateMessages = async () => {
    const response = await this.fetchLatest()
    if (!response.continuation?.token) {
      throw new Error('No continuation token is present')
    }

    const token = response.continuation.token
    const chatItems = response.actions
      .filter(action => isAddChatAction(action))
      .map(item => this.toChatItem(item as AddChatItemAction))
    this.chatStore.addChat(token, chatItems)
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