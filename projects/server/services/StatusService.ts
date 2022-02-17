import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { GenericObject } from '@rebel/server/types'
import { avg } from '@rebel/server/util/math'

type Deps = Dependencies<GenericObject>

export default class StatusService extends ContextClass {
  private masterchatResponseTimes: number[]
  private lastMasterchatOk: number | null
  private lastMasterchatStatus: 'ok' | 'error' | null

  constructor (deps: Deps) {
    super()
    this.masterchatResponseTimes = []
    this.lastMasterchatOk = null
    this.lastMasterchatStatus = null
  }

  public getApiStatus (): PublicApiStatus {
    return {
      schema: 1,
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
