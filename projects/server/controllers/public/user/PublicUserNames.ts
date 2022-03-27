import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicLevelInfo } from '@rebel/server/controllers/public/user/PublicLevelInfo'

export type PublicUserNames = PublicObject<1, {
  schema: 1

  /** The internal id of the user. */
  id: number

  /** All or some of the current YouTube channel names that this user owns. */
  youtubeChannelNames: string[]

  /** All or some of the current Twitch channel names that this user owns. */
  twitchChannelNames: string[]

  /** Current level of the user. */
  levelInfo: Tagged<1, PublicLevelInfo>
}>
