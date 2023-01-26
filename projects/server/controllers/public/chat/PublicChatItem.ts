import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicMessagePart } from '@rebel/server/controllers/public/chat/PublicMessagePart'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicChatItem = PublicObject<4, {
  schema: 4

  /** Internal id of the message. */
  id: number

  /** Timestamp at which the message was sent. */
  timestamp: number

  /** The platform on which the message was sent. */
  platform: 'youtube' | 'twitch'

  /** Whether the message has been identified as a chat command. */
  isCommand: boolean

  /** The message parts that make up the contents of the message, ordered from left to right. */
  messageParts: Tagged<3, PublicMessagePart>[]

  /** The user that authored the message. */
  author: Tagged<3, PublicUser>
}>
