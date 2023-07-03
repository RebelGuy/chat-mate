import { PublicObject } from '@rebel/api-models/types'

export type PublicLinkAttemptStep = PublicObject<{
  /** The timestamp at which this step was completed. */
  timestamp: number

  /** A description of this step. */
  description: string

  /** The total number of warnings accumulated after the current link attempt step. */
  accumulatedWarnings: number
}>
