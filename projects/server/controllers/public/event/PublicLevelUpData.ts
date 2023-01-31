import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicLevelUpData = PublicObject<{
  /** The level before the event occurred. */
  oldLevel: number

  /** The new level that triggered the event. */
  newLevel: number

  user: PublicObject<PublicUser>
}>
