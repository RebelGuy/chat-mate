import { PublicObject } from '@rebel/api-models/types'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'

export type PublicLevelUpData = PublicObject<{
  /** The level before the event occurred. */
  oldLevel: number

  /** The new level that triggered the event. */
  newLevel: number

  user: PublicObject<PublicUser>
}>
