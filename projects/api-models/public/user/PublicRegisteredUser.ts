import { PublicObject } from '@rebel/api-models/types'

export type PublicRegisteredUser = PublicObject<{
  /** The internal ID of the registered user. */
  id: number

  /** The username of the registered user. */
  displayName: string
}>
