import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicLogTimestamps = PublicObject<1, {
  schema: 1

  /** Timestamps of errors encountered in the last 24 hours, in ascending order. */
  warnings: number[]

  /** Timestamps of errors encountered in the last 24 hours, in ascending order. */
  errors: number[]
}>
