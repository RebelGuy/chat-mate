import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicLevelInfo = PublicObject<1, {
  schema: 1

  /** The current level of this user. Non-negative integer value. */
  level: number

  /** The current relative progress to the next level. 0 <= x < 1. */
  levelProgress: number
}>