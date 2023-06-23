import { Dependencies } from '@rebel/shared/context/context'
import StatusService from '@rebel/server/services/StatusService'
import { nameof } from '@rebel/shared/testUtils'
import * as data from '@rebel/server/_test/testData'

let statusService: StatusService

beforeEach(() => {
  statusService = new StatusService(new Dependencies({}))
})

describe(nameof(StatusService, 'getApiStatus'), () => {
  test('empty state returns initial', () => {
    const result = statusService.getApiStatus()

    expect(result.avgRoundtrip).toBeNull()
    expect(result.lastOk).toBeNull()
    expect(result.status).toBeNull()
  })

  test('non-empty state returns correct values', () => {
    const time1 = data.time1.getTime()
    const time2 = data.time2.getTime()
    statusService.onRequestDone(time1, 'ok', 200)
    statusService.onRequestDone(time2, 'error', 400)

    const result = statusService.getApiStatus()

    expect(result).toEqual(expect.objectContaining({
      avgRoundtrip: 300,
      lastOk: time1,
      status: 'error'
    }))
  })
})

describe(nameof(StatusService, 'onRequestDone'), () => {
  test('does not crash upon many calls', () => {
    for (let i = 0; i < 1000; i++) {
      statusService.onRequestDone(Date.now(), i % 100 === 0 ? 'error' : 'ok', Math.round(Math.random() * 100))
    }
    const status = statusService.getApiStatus()

    expect(status.avgRoundtrip).not.toBeNull()
    expect(status.lastOk).not.toBeNull()
    expect(status.status).not.toBeNull()
  })
})
