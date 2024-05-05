import { PublicChatImage } from '@rebel/api-models/public/chat/PublicChatImage'
import { PublicChatItem } from '@rebel/api-models/public/chat/PublicChatItem'
import { PublicChatMateEvent } from '@rebel/api-models/public/event/PublicChatMateEvent'
import { SafeExtract } from '@rebel/shared/types'

export type ClientMessage =
  { type: 'subscribe', data: SubscribeMessageData } |
  { type: 'unsubscribe', data: UnsubscribeMessageData }

type SubscribeMessageData = {
  topic: StreamerTopic
  streamer: string
}

type UnsubscribeMessageData = {
  topic: StreamerTopic
  streamer: string
}

type StreamerTopic = 'streamerChat' | 'streamerEvents'

export type ServerMessage =
  { type: 'acknowledge', data: AcknowledgeMessageData } |
  { type: 'event', data: EventMessageData }

type AcknowledgeMessageData = {
  success: boolean
}

type EventMessageData =
  { topic: SafeExtract<StreamerTopic, 'streamerChat'>, streamer: string, data: PublicChatItem } |
  { topic: SafeExtract<StreamerTopic, 'streamerEvents'>, streamer: string, data: PublicChatMateEvent }

export function parseClientMessage (message: Buffer | ArrayBuffer | Buffer[]): ClientMessage | null {
  if (message instanceof ArrayBuffer || Array.isArray(message)) {
    return null
  }

  let parsedMessage: unknown
  try {
    parsedMessage = JSON.parse(message.toString())
  } catch (e: any) {
    return null
  }

  if (parsedMessage == null || Array.isArray(parsedMessage) || typeof parsedMessage !== 'object') {
    return null
  }

  if (!('type' in parsedMessage) || !('data' in parsedMessage)) {
    return null
  }

  if (parsedMessage.type === 'subscribe' || parsedMessage.type === 'unsubscribe') {
    if (parsedMessage.data == null || typeof parsedMessage.data !== 'object' || !('topic' in parsedMessage.data) || !('streamer' in parsedMessage.data)) {
      return null
    }

    if (parsedMessage.data.topic !== 'streamerChat' && parsedMessage.data.topic !== 'streamerEvents') {
      return null
    }

    if (typeof parsedMessage.data.streamer !== 'string') {
      return null
    }

    return {
      type: parsedMessage.type,
      data: {
        topic: parsedMessage.data.topic,
        streamer: parsedMessage.data.streamer
      }
    }
  } else {
    return null
  }
}
