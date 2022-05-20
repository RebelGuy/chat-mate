import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicMessagePart } from '@rebel/server/controllers/public/chat/PublicMessagePart'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicChatItem = PublicObject<3, {
  schema: 3

  /** Internal id of the message. */
  id: number

  /** Timestamp at which the message was sent. */
  timestamp: number

  /** The platform on which the message was sent. */
  platform: 'youtube' | 'twitch'

  /** The message parts that make up the contents of the message, ordered from left to right. */
  messageParts: Tagged<3, PublicMessagePart>[]

  /** The user that authored the message. */
  author: Tagged<2, PublicUser>
}>
