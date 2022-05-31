import { Action, AddChatItemAction, ChatResponse, Metadata, YTRun } from '@rebel/masterchat'
import { IMasterchat } from '@rebel/server/interfaces'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import LogService from '@rebel/server/services/LogService'
import { MakeRequired } from '@rebel/server/types'
import { listenForUserInput } from '@rebel/server/util/input'

const CHAT_RATE = 0.5

export default class MockMasterchat implements IMasterchat {
  readonly name = MockMasterchat.name

  readonly logService: LogService

  private counter: number = 0
  private lastFetch: number = Date.now()

  // for debugging:
  // - `static`: manually set the `this.mockMessages` array, and cycle through them
  // - `input`: can add new messages live via the terminal window
  //   IMPORTANT: this only works if running the process manually in the terminal, NOT via the VSCode debugger
  private mockType: 'static' | 'input' = 'input'
  private mockMessages: string[] | null = null

  constructor (logService: LogService) {
    this.logService = logService

    if (this.mockType === 'input') {
      this.mockMessages = []
      listenForUserInput(msg => (this.mockMessages as string[]).push(msg))
    } else if (this.mockType === 'static' && (this.mockMessages == null || this.mockMessages.length === 0)) {
      this.logService.logWarning(this, 'MockType was set to static, but no mock messages were provided')
    }
  }

  public async fetch (): Promise<ChatResponse> {
    const now = Date.now()
    const elapsed = now - this.lastFetch
    this.lastFetch = now

    if (elapsed / 1000 < 1 / CHAT_RATE || this.mockMessages?.length === 0) {
      return MockMasterchat.buildResponse()
    }

    let customMessage: string = 'Message'
    if (this.mockType === 'static' && this.mockMessages != null && this.mockMessages.length > 0) {
      customMessage = this.mockMessages[this.counter % this.mockMessages.length]
    } else if (this.mockType === 'input') {
      if (this.mockMessages!.length === 0) {
        return MockMasterchat.buildResponse()
      } else {
        customMessage = this.mockMessages!.shift()!
      }
    }

    const item: ChatItemWithRelations = generateFakeChatItem(customMessage)
    const channelInfo = item.youtubeChannel!.infoHistory[0]!
    const action: MakeRequired<AddChatItemAction> = {
      type: 'addChatItemAction',
      id: item.externalId,
      timestamp: item.time,
      timestampUsec: `${item.time.getTime() * 1000}`,
      authorName: channelInfo.name,
      authorChannelId: item.youtubeChannel!.youtubeId,
      authorPhoto: channelInfo.imageUrl,
      membership: undefined,
      isOwner: channelInfo.isOwner,
      isModerator: channelInfo.isModerator,
      isVerified: channelInfo.isVerified,
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
              emojiId: part.emoji.externalId!,
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

  // eslint-disable-next-line @typescript-eslint/require-await
  public async fetchMetadata (): Promise<Metadata> {
    return {
      channelId: 'mock channel id',
      videoId: 'mock video id',
      channelName: 'mock channel name',
      liveStatus: 'live',
      title: 'mock title'
    }
  }

  public banYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    return new Promise(() => true)
  }

  public unbanYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    return new Promise(() => true)
  }

  private static buildResponse (action?: Action): Promise<ChatResponse> {
    return new Promise((resolve, _) => resolve({
      actions: action ? [action] : [],
      continuation: { timeoutMs: 10000, token: 'mock_continuationToken' },
      error: null
    }))
  }
}
function generateFakeChatItem (text: string): ChatItemWithRelations {
  return {
    externalId: randomString(10),
    time: new Date(),
    id: 1,
    livestreamId: 1,
    userId: 1,
    contextToken: null,
    twitchChannel: null,
    twitchChannelId: null,
    youtubeChannelId: 1,
    youtubeChannel: {
      id: 1,
      userId: 1,
      youtubeId: randomString(10),
      infoHistory: [{
        isVerified: randomBoolean(),
        isModerator: randomBoolean(),
        isOwner: randomBoolean(),
        name: randomString(['A name', 'Some user', 'asdfaklsjdf']),
        channelId: 1,
        id: 1,
        imageUrl: 'www.image.com',
        time: new Date()
      }]
    },
    chatMessageParts: [{
      id: 1,
      chatMessageId: 1,
      emoji: null,
      emojiId: null,
      order: 0,
      textId: 1,
      text: {
        id: 1,
        isBold: randomBoolean(),
        isItalics: randomBoolean(),
        text
      },
      customEmojiId: null,
      customEmoji: null,
      cheerId: null,
      cheer: null
    }]
  }
}

function randomBoolean () {
  return Math.random() < 0.5
}

function randomString (options: string[] | number) {
  if (typeof options === 'number') {
    // returns a random string (found somewhere on SO)
    return Math.random().toString(36).substring(2, 10)
  } else {
    return options[Math.floor(Math.random() * options.length)]
  }
}
