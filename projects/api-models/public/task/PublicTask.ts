import { PublicObject } from '@rebel/api-models/types'

export type PublicTask = PublicObject<{
  /** The type of task this object represents. The types are hardcoded in the database. */
  taskType: string

  /** How often this task is run on the server, in milliseconds. */
  intervalMs: number

  /** The timestamp of the last successful run, if any. */
  lastSuccess: number | null

  /** The timestamp of the last failed run, if any. */
  lastFailure: number | null
}>
