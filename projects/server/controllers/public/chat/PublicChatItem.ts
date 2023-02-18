import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessagePart } from '@rebel/server/controllers/public/chat/PublicMessagePart'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicChatItem = PublicObject<{
  /** Internal id of the message. */
  id: number

  /** Timestamp at which the message was sent. */
  timestamp: number

  /** The platform on which the message was sent. */
  platform: 'youtube' | 'twitch'

  /** The command ID associated with this message. Null if the message has not been identified as a chat command. */
  commandId: number | null

  /** The message parts that make up the contents of the message, ordered from left to right. */
  messageParts: PublicObject<PublicMessagePart>[]

  /** The user that authored the message. */
  author: PublicObject<PublicUser>
}>
