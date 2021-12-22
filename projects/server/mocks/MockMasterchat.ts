import { Action, AddChatItemAction, ChatResponse, YTRun } from '@rebel/masterchat'
import { IMasterchat } from '@rebel/server/interfaces'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import LogService from '@rebel/server/services/LogService'
import ChatStore from '@rebel/server/stores/ChatStore'
import { MakeRequired } from '@rebel/server/types'
import { listenForUserInput } from '@rebel/server/util/input'

const CHAT_RATE = 0.5

export default class MockMasterchat implements IMasterchat {
  readonly name = MockMasterchat.name

  readonly logService: LogService
  readonly chatStore: ChatStore

  // the chat items loaded from the livestream will be used as a base for emitted messages
  private chatItems: ChatItemWithRelations[] | null = null
  private counter: number = 0
  private lastFetch: number = Date.now()

  // for debugging:
  // - `data`: load messages from the database and cycle through them
  // - `static`: manually set the `this.mockMessages` array, and cycle through them
  // - `input`: can add new messages live via the terminal window
  //   IMPORTANT: this only works if running the process manually in the terminal, NOT via the VSCode debugger
  private mockType: 'data' | 'static' | 'input' = 'data'
  private mockMessages: string[] | null = null

  constructor (logService: LogService, chatStore: ChatStore) {
    this.logService = logService
    this.chatStore = chatStore

    if (this.mockType === 'input') {
      this.mockMessages = []
      listenForUserInput(msg => (this.mockMessages as string[]).push(msg))
    } else if (this.mockType === 'static' && (this.mockMessages == null || this.mockMessages.length === 0)) {
      this.logService.logWarning(this, 'MockType was set to static, but no mock messages were provided')
    }
  }

  public async fetch (): Promise<ChatResponse> {
    if (this.chatItems == null) {
      this.chatItems = await this.chatStore.getChatSince(0)
      if (this.chatItems.length === 0) {
        throw new Error('MockMasterchat cannot continue because no mock data exists.')
      }
    }

    const now = Date.now()
    const elapsed = now - this.lastFetch
    this.lastFetch = now

    if (elapsed / 1000 < 1 / CHAT_RATE || this.mockType !== 'data' && this.mockMessages?.length === 0) {
      return MockMasterchat.buildResponse()
    }

    let item = this.chatItems[this.counter % this.chatItems.length]
    item = {
      ...item,
      youtubeId: `mock_${now}`,
      time: new Date()
    }

    let customMessage: string | null = null
    if (this.mockType === 'static' && this.mockMessages != null && this.mockMessages.length > 0) {
      customMessage = this.mockMessages[this.counter % this.mockMessages.length]
    } else if (this.mockType === 'input') {
      if (this.mockMessages!.length === 0) {
        return MockMasterchat.buildResponse()
      } else {
        customMessage = this.mockMessages!.shift()!
      }
    }

    const channelInfo = item.channel.infoHistory[0]!
    const action: MakeRequired<AddChatItemAction> = {
      type: 'addChatItemAction',
      id: item.youtubeId,
      timestamp: item.time,
      timestampUsec: `${item.time.getTime() * 1000}`,
      authorName: channelInfo.name,
      authorChannelId: item.channel.youtubeId,
      authorPhoto: channelInfo.imageUrl,
      membership: undefined,
      isOwner: channelInfo.isOwner,
      isModerator: channelInfo.isModerator,
      isVerified: channelInfo.IsVerified,
      message: item.chatMessageParts.map((part, i) => {
        if (part.text && !part.emoji || customMessage && i === 0) {
          return {
            text: customMessage ?? part.text!.text,
            bold: part.text?.isBold ?? false,
            italics: part.text?.isItalics ?? false
          } as YTRun
        } else if (!part.text && part.emoji) {
          return {
            emoji: {
              emojiId: part.emoji.youtubeId!,
              image: {
                accessibility: { accessibilityData: { label: part.emoji.name }},
                thumbnails: [{ url: part.emoji.imageUrl, width: part.emoji.imageWidth, height: part.emoji.imageHeight }]
              },
              shortcuts: [part.emoji.label],
            }
          } as YTRun
        } else {
          throw new Error('ChatMessageParts must have either the text or the emoji component defined')
        }
      }),
      contextMenuEndpointParams: '',
      rawMessage: []
    }

    this.counter++
    return MockMasterchat.buildResponse(action)
  }

  private static buildResponse (action?: Action): Promise<ChatResponse> {
    return new Promise((resolve, _) => resolve({
      actions: action ? [action] : [],
      continuation: { timeoutMs: 10000, token: 'mock_continuationToken' },
      error: null
    }))
  }
}
