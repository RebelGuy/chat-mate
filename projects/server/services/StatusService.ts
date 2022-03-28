import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { GenericObject } from '@rebel/server/types'
import { avg } from '@rebel/server/util/math'

type Deps = Dependencies<GenericObject>

export default class StatusService extends ContextClass {
  private responseTimes: number[]
  private lastOk: number | null
  private lastStatus: 'ok' | 'error' | null

  constructor (deps: Deps) {
    super()
    this.responseTimes = []
    this.lastOk = null
    this.lastStatus = null
  }

  public getApiStatus (): PublicApiStatus {
    return {
      schema: 1,
      status: this.lastStatus,
      lastOk: this.lastOk,
      avgRoundtrip: avg(...this.responseTimes)
    }
  }

  public onRequestDone (timestamp: number, status: 'ok' | 'error', responseTime: number) {
    if (status === 'ok') {
      this.lastOk = timestamp
    }

    this.lastStatus = status

    const N = this.responseTimes.length
    if (N >= 10) {
      this.responseTimes.splice(0, N - 9)
    }
    this.responseTimes.push(responseTime)
  }
}
