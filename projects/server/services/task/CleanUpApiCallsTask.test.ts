import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import CleanUpApiCallsTask from '@rebel/server/services/task/CleanUpApiCallsTask'
import PlatformApiStore from '@rebel/server/stores/PlatformApiStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'
import { MockProxy, mock } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { NO_OP } from '@rebel/shared/util/typescript'

let mockPlatformApiStore: MockProxy<PlatformApiStore>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let cleanUpApiCallsTask: CleanUpApiCallsTask

beforeEach(() => {
  mockPlatformApiStore = mock()
  mockDateTimeHelpers = mock()

  cleanUpApiCallsTask = new CleanUpApiCallsTask(new Dependencies({
    platformApiStore: mockPlatformApiStore,
    dateTimeHelpers: mockDateTimeHelpers
  }))
})

describe(nameof(CleanUpApiCallsTask, 'execute'), () => {
  test('Removes api calls', async () => {
    mockDateTimeHelpers.now.calledWith().mockReturnValue(data.time1)

    await cleanUpApiCallsTask.execute(NO_OP)

    expect(mockPlatformApiStore.removeSuccessfulRequestsSince.mock.calls.length).toBeGreaterThan(0)
  })
})
