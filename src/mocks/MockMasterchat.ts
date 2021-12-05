import { AddChatItemAction, ChatResponse, YTRun } from '@rebel/../../masterchat/lib/masterchat'
import { IMasterchat } from '@rebel/interfaces'
import { ChatItem } from '@rebel/models/chat'
import FileService from '@rebel/services/FileService'
import { ChatSave } from '@rebel/stores/ChatStore'

const CHAT_RATE = 0.5

export default class MockMasterchat implements IMasterchat {
  readonly fileService: FileService
  readonly mockData: string
  readonly chatItems: ChatItem[]

  private counter: number = 0
  private lastFetch: number = Date.now()

  constructor (fileService: FileService, mockData: string) {
    this.fileService = fileService
    this.mockData = mockData

    const loadedItems = this.fileService.loadObject<ChatSave>(mockData)?.chat
    if (loadedItems == null || loadedItems.length === 0) {
      throw new Error('Could not instantiate MockMasterchat because no mock data exists.')
    }
    this.chatItems = loadedItems
  }

  public fetch (): Promise<ChatResponse> {
    const now = Date.now()
    const elapsed = now - this.lastFetch
    this.lastFetch = now

    if (elapsed / 1000 < 1 / CHAT_RATE) {
      return new Promise((resolve, _) => resolve({
        actions: [],
        continuation: { timeoutMs: 1000, token: 'continuationToken' },
        error: null
      }))
    }

    let item = this.chatItems[this.counter++ % this.chatItems.length]
    item = {
      ...item,
      timestamp: new Date().getTime()
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
            text: part.text,
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

    return new Promise((resolve, _) => resolve({
      actions: [action],
      continuation: { timeoutMs: 1000, token: 'continuationToken' },
      error: null
    }))
  }
}
