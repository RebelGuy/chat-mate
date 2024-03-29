import { PublicObject } from '@rebel/api-models/types'

export type PublicApiStatus = PublicObject<{
  /** The current masterchat API status. Null if no data is available yet. */
  status: 'ok' | 'error' | null

  /** The last timestamp at which the status was `ok`, if any. */
  lastOk: number | null

  /** Average time, in ms, taken to receive recent responses. Null if no data is available yet. */
  avgRoundtrip: number | null
}>
