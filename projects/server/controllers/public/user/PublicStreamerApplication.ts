import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicStreamerApplication = PublicObject<1, {
  schema: 1

  /** The internal id of the application. */
  id: number

  /** The user that has created the application. */
  username: string

  /** The current status of the application. */
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'

  /** The timestamp at which this application was created. */
  timeCreated: number

  /** The user message authored during the creation of the application. */
  message: string

  /** If status is not `pending`, an admin message authored during the closing of the application. */
  closeMessage: string | null

  /** If status is not `pending`, the timestamp at which this application was closed. */
  timeClosed: number | null
}>
