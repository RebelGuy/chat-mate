import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicLevelUpData = PublicObject<2, {
  schema: 2

  /** The level before the event occurred. */
  oldLevel: number

  /** The new level that triggered the event. */
  newLevel: number

  user: Tagged<2, PublicUser>
}>
