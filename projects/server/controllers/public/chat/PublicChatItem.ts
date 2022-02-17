import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessagePart } from '@rebel/server/controllers/public/chat/PublicMessagePart'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicChatItem = PublicObject<1, {
  schema: 1

  /** Internal id of the message. */
  id: number

  /** Timestamp at which the message was sent. */
  timestamp: number

  /** The message parts that make up the contents of the message, ordered from left to right. */
  messageParts: PublicMessagePart[]

  /** The user that authored the message. */
  author: PublicUser
}>
