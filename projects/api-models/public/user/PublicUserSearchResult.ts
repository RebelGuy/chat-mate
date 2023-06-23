import { PublicObject } from '@rebel/api-models/types'
import {  PublicChannel } from '@rebel/api-models/public/user/PublicChannel'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'

export type PublicUserSearchResult = PublicObject<{
  /** The user associated with the match. May be a default or aggregate user. Always an aggregate user if searching for registered users. */
  user: PublicUser

  /** The user's channel that matched the search query. Never null when searching for channels, always null when searching for registered users. */
  matchedChannel: PublicChannel | null

  /** All channels of the user, includes the matched channel name. */
  allChannels: PublicChannel[]
}>
