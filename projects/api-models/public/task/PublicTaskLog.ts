import { PublicObject } from '@rebel/api-models/types'

export type PublicTaskLog = PublicObject<{
  /** The internal id of this task log. */
  id: number

  /** The timestamp at which this task was started. */
  startTime: number

  /** The timestamp at which this task finished. Null if the task is still in progress. */
  endTime: number | null

  /** Output logs that were collected while the task was running. */
  log: string

  /** The error message returned by the task if it failed. Null if the task succeeded or is still in progress. */
  errorMessage: string | null
}>
