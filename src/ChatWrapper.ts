
import { AddChatItemAction, Masterchat, stringify } from "masterchat"

const CREDS = "eyJTSUQiOiJEd2hseWU2ZXpDWHM0YjJIZEFiNTNFNVhSSXpOaGp6NW5nZXdEaHJmNV9SaV92N1RFX0lMbUowZU11dzE1M1FOeW1sT1hBLiIsIkhTSUQiOiJBYXd0UGxtU1lLSjBrTm92ZSIsIlNTSUQiOiJBdU0wNjJHYWtyWWdZenc0WCIsIkFQSVNJRCI6IjgyZ1ZneEdNbnRXR2NTT1kvQXBMXzhfbmhwNV9zVmR0eGciLCJTQVBJU0lEIjoiLVpkZmRHZjNSWTc4WHVTNi9BdlhQT2cyY0NLY3hpVzZmOCJ9"
const LIVE_ID = 'X0MnBL4iRK4'
const CHANNEL_ID = 'UCBDVDOdE6HOvWdVHsEOeQRA'

export default class ChatWrapper {
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
  }
  
  stop () {
    if (!this.interval) {
      return
    }

    clearInterval(this.interval)
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