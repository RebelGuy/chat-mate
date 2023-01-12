import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import {  PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicUserSearchResult = PublicObject<1, {
  schema: 1,

  /** The user associated with the matched channel. */
  user: PublicUser

  /** The user's channel that matched the search query. */
  matchedChannel: PublicChannel

  /** All channels of the user, includes the matched channel name. */
  allChannels: PublicChannel[]
}>
