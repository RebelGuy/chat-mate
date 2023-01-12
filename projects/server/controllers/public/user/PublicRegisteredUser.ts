import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicRegisteredUser = PublicObject<1, {
  schema: 1,

  /** The internal ID of the registered user. */
  id: number

  /** The username of the registered user. */
  displayName: string
}>