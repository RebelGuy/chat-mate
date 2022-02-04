import { Dependencies } from '@rebel/server/context/context'
import { GenericObject } from '@rebel/server/types'
import { avg } from '@rebel/server/util/math'

export type ApiStatus = {
  // null if no data is available yet
  status: 'ok' | 'error' | null

  // the last timestamp at which the status was `ok`, if any
  lastOk: number | null

  // average time taken to receive recent responses, or null if no data is available yet
  avgRoundtrip: number | null
}

type Deps = Dependencies<GenericObject>

export default class StatusService {
  private masterchatResponseTimes: number[]
  private lastMasterchatOk: number | null
  private lastMasterchatStatus: 'ok' | 'error' | null

  constructor (deps: Deps) {
    this.masterchatResponseTimes = []
    this.lastMasterchatOk = null
    this.lastMasterchatStatus = null
  }

  public getApiStatus (): ApiStatus {
    return {
      status: this.lastMasterchatStatus,
      lastOk: this.lastMasterchatOk,
      avgRoundtrip: avg(...this.masterchatResponseTimes)
    }
  }

  public onMasterchatRequest (timestamp: number, status: 'ok' | 'error', responseTime: number) {
    if (status === 'ok') {
      this.lastMasterchatOk = timestamp
    }

    this.lastMasterchatStatus = status

    const N = this.masterchatResponseTimes.length
    if (N >= 10) {
      this.masterchatResponseTimes.splice(0, N - 9)
    }
    this.masterchatResponseTimes.push(responseTime)
  }
}
