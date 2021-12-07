import { Action, AddChatItemAction, ChatResponse, YTRun } from '@rebel/../../masterchat/lib/masterchat'
import { IMasterchat } from '@rebel/interfaces'
import { ChatItem } from '@rebel/models/chat'
import FileService from '@rebel/services/FileService'
import LogService from '@rebel/services/LogService'
import { ChatSave } from '@rebel/stores/ChatStore'
import { listenForUserInput } from '@rebel/util/input'

const CHAT_RATE = 0.5

export default class MockMasterchat implements IMasterchat {
  readonly name = MockMasterchat.name

  readonly fileService: FileService
  readonly logService: LogService
  readonly mockData: string

  // the chat items loaded from the mockData file will be used as a base for emitted messages
  readonly chatItems: ChatItem[]

  private counter: number = 0
  private lastFetch: number = Date.now()

  // for debugging:
  // - `file`: load messages from the `mockData` file and cycle through them
  // - `static`: manually set the `this.mockMessages` array, and cycle through them
  // - `input`: can add new messages live via the terminal window
  //   IMPORTANT: this only works if running the process manually in the terminal
  private mockType: 'file' | 'static' | 'input' = 'input'
  private mockMessages: string[] | null = null

  constructor (fileService: FileService, logService: LogService, mockData: string) {
    this.fileService = fileService
    this.logService = logService
    this.mockData = mockData

    const loadedItems = this.fileService.readObject<ChatSave>(mockData)?.chat
    if (loadedItems == null || loadedItems.length === 0) {
      throw new Error('Could not instantiate MockMasterchat because no mock data exists.')
    }
    this.chatItems = loadedItems

    if (this.mockType === 'input') {
      this.mockMessages = []
      listenForUserInput(msg => (this.mockMessages as string[]).push(msg))
    } else if (this.mockType === 'static' && (this.mockMessages == null || this.mockMessages.length === 0)) {
      this.logService.logWarning(this, 'MockType was set to static, but no mock messages were provided')
    }
  }

  public fetch (): Promise<ChatResponse> {
    const now = Date.now()
    const elapsed = now - this.lastFetch
    this.lastFetch = now

    if (elapsed / 1000 < 1 / CHAT_RATE || this.mockMessages?.length === 0) {
      return MockMasterchat.buildResponse()
    }

    let item = this.chatItems[this.counter % this.chatItems.length]
    item = {
      ...item,
      timestamp: new Date().getTime()
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

    const action: AddChatItemAction = {
      type: 'addChatItemAction',
      id: item.id,
      timestamp: new Date(item.timestamp),
      timestampUsec: `${item.timestamp * 1000}`,
      authorName: item.author.name,
      authorChannelId: item.author.channelId,
      authorPhoto: item.author.image,
      isOwner: item.author.attributes.isOwner,
      isModerator: item.author.attributes.isModerator,
      isVerified: item.author.attributes.isVerified,
      message: item.messageParts.map(part => {
        if (part.type === 'text') {
          return {
            text: customMessage ?? part.text,
            bold: part.isBold,
            italics: part.isItalics
          } as YTRun
        } else {
          return {
            emoji: {
              image: {
                accessibility: { accessibilityData: { label: part.name }},
                thumbnails: [part.image]
              },
              shortcuts: [part.label],
            }
          } as YTRun
        }
      }),
      contextMenuEndpointParams: '',
      rawMessage: []
    }

    this.counter++
    return MockMasterchat.buildResponse(action)
  }

  private static buildResponse(action?: Action): Promise<ChatResponse> {
    return new Promise((resolve, _) => resolve({
      actions: action ? [action] : [],
      continuation: { timeoutMs: 10000, token: 'continuationToken' },
      error: null
    }))
  }
}
