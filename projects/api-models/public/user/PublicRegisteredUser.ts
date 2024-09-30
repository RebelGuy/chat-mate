import { PublicObject } from '@rebel/api-models/types'

export type PublicRegisteredUser = PublicObject<{
  /** The internal ID of the registered user. */
  id: number

  /** The unique username identifying this user. */
  username: string

  /** The customisable display name of this user. Null if not set. */
  displayName: string | null
}>
