import { Dependencies } from '@rebel/server/context/context'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import LogsQueryClientProvider from '@rebel/server/providers/LogsQueryClientProvider'
import LogQueryService, { LogTimestamps } from '@rebel/server/services/LogQueryService'
import { addTime } from '@rebel/server/util/datetime'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let logQueryService: LogQueryService

beforeEach(() => {
  mockDateTimeHelpers = mock()

  logQueryService = new LogQueryService(new Dependencies({
    dateTimeHelpers: mockDateTimeHelpers,
    logAnalyticsWorkspaceId: '_unused',
    logsQueryClientProvider: mock()
  }))
})

describe(nameof(LogQueryService, 'queryCriticalLogs'), () => {
  test('returns warnings and errors from the last day', () => {
    const now = new Date()
    const t1_error = addTime(now, 'days', -1.5).getTime()
    const t2_error = addTime(now, 'days', -0.5).getTime()
    const t3_error = addTime(now, 'days', -0.1).getTime()
    const t4_warning = addTime(now, 'days', -1.5).getTime()
    const t5_warning = addTime(now, 'days', -0.5).getTime()
    const t6_warning = addTime(now, 'days', -0.1).getTime()

    mockDateTimeHelpers.ts
      .mockReturnValueOnce(t1_error)
      .mockReturnValueOnce(t2_error)
      .mockReturnValueOnce(t3_error)
      .mockReturnValueOnce(t4_warning)
      .mockReturnValueOnce(t5_warning)
      .mockReturnValueOnce(t6_warning)
    mockDateTimeHelpers.now.calledWith().mockReturnValue(now)

    logQueryService.onWarning()
    logQueryService.onWarning()
    logQueryService.onWarning()
    logQueryService.onError()
    logQueryService.onError()
    logQueryService.onError()

    const result = logQueryService.queryCriticalLogs()

    expect(result).toEqual<LogTimestamps>({
      errors: [t2_error, t3_error],
      warnings: [t5_warning, t6_warning]
    })
  })
})