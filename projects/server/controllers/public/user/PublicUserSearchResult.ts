import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import {  PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicUserSearchResult = PublicObject<1, {
  schema: 1,

  /** The user associated with the match. May be a default or aggregate user. Always an aggregate user if searching for registered users. */
  user: PublicUser

  /** The user's channel that matched the search query. Never null when searching for channels, always null when searching for registered users. */
  matchedChannel: PublicChannel | null

  /** All channels of the user, includes the matched channel name. */
  allChannels: PublicChannel[]
}>
