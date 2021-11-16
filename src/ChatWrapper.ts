
import { AddChatItemAction, Masterchat, stringify, YTEmojiRun, YTRun, YTTextRun } from "masterchat"
import { ChatItem, PartialChatMessage, PartialTextChatMessage } from "./models/Chat"

const CREDS = "eyJTSUQiOiJEd2hseWU2ZXpDWHM0YjJIZEFiNTNFNVhSSXpOaGp6NW5nZXdEaHJmNV9SaV92N1RFX0lMbUowZU11dzE1M1FOeW1sT1hBLiIsIkhTSUQiOiJBYXd0UGxtU1lLSjBrTm92ZSIsIlNTSUQiOiJBdU0wNjJHYWtyWWdZenc0WCIsIkFQSVNJRCI6IjgyZ1ZneEdNbnRXR2NTT1kvQXBMXzhfbmhwNV9zVmR0eGciLCJTQVBJU0lEIjoiLVpkZmRHZjNSWTc4WHVTNi9BdlhQT2cyY0NLY3hpVzZmOCJ9"
const LIVE_ID = 'X0MnBL4iRK4'
const CHANNEL_ID = 'UCBDVDOdE6HOvWdVHsEOeQRA'

type ChatEvents = {
  newChatItem: {
    item: ChatItem
  }
}

// todo: rename to ChatService
export default class ChatWrapper {
  private listeners: Map<keyof ChatEvents, ((data: any) => void)[]> = new Map()

  // todo: persist messages and last token
  // what happens if the token is very old? can we get ALL messages until now in a single request, or what happens?
  private allMsg: string[] = []
  private continuationToken: string | null = null

  // note: there is a bug where the "live chat" (as opposed to "top chat") option doesn't work, so any
  // messages that might be spammy/inappropriate will not show up.
  private readonly chat: Masterchat

  private interval: NodeJS.Timer | null = null

  constructor () {
    this.chat = new Masterchat(LIVE_ID, CHANNEL_ID, { mode: 'live', credentials: CREDS })
  }

  start () {
    if (this.interval) {
      return
    }

    // todo: can add dynamic timeout that adjusts for busy periods, up to twice per second
    this.interval = setInterval(this.updateMessages, 2000)
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

  private toChatItem (item: AddChatItemAction): ChatItem {
    return {
      internalId: 0, // todo
      id: item.id,
      timestamp: item.timestamp,
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
      message: item.message.map((run: YTRun): PartialChatMessage => {
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
            text: run.emoji.emojiId,
            image: run.emoji.image.thumbnails[0]!
          }
        }
      })
    }
  }

  private generateMessage = (chat: AddChatItemAction): string => {
    return `${chat.timestamp} ${chat.authorName}: ${stringify(chat.message)}`
  }

  private fetch = () => {
    return this.continuationToken ? this.chat.fetch(this.continuationToken!) : this.chat.fetch()
  }

  private updateMessages = async () => {
    const response = await this.fetch()
    if (!response.continuation?.token) {
      throw new Error('No continuation token is present')
    }

    console.log(response.actions.length)
    this.continuationToken = response.continuation.token
    response.actions.forEach(action => {
      if (action.type === 'addChatItemAction') {
        const msg = this.generateMessage(action as AddChatItemAction)
        if (!this.allMsg.includes(msg)) {
          this.allMsg.push(msg)
        }
      }
    })

    console.log('current count:', this.allMsg.length)
  }
}

function isTextRun (run: YTRun): run is YTTextRun {
  return (run as any).emoji == null
}