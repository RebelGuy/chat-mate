import { PublicObject } from '@rebel/api-models/types'

export type PublicLevelInfo = PublicObject<{
  /** The current level of this user. Non-negative integer value. */
  level: number

  /** The current relative progress to the next level. 0 <= x < 1. */
  levelProgress: number
}>
