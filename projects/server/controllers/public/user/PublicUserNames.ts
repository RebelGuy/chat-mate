import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicUserNames = PublicObject<2, {
  schema: 2

  /** The user that is associated with these usernames. */
  user: Tagged<2, PublicUser>

  /** All or some of the current YouTube channel names that this user owns. */
  youtubeChannelNames: string[]

  /** All or some of the current Twitch channel names that this user owns. */
  twitchChannelNames: string[]
}>
