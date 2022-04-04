import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicNewTwitchFollowerData = PublicObject<1, {
  schema: 1

  /** The dispay name of the user that has followed. */
  displayName: string
}>
