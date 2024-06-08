import { Dependencies } from '@rebel/shared/context/context'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { GenericObject } from '@rebel/shared/types'
import { avg } from '@rebel/shared/util/math'

type Deps = Dependencies<GenericObject>

type ApiStatus = {
  status: 'ok' | 'error' | null;
  lastOk: number | null;
  avgRoundtrip: number | null;
}

export default class StatusService extends SingletonContextClass {
  private responseTimes: number[]
  private lastOk: number | null
  private lastStatus: 'ok' | 'error' | null

  constructor (deps: Deps) {
    super()
    this.responseTimes = []
    this.lastOk = null
    this.lastStatus = null
  }

  public getApiStatus (): ApiStatus {
    return {
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
