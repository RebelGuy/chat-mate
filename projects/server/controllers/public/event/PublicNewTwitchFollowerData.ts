import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicNewTwitchFollowerData = PublicObject<{
  /** The dispay name of the user that has followed. */
  displayName: string
}>
