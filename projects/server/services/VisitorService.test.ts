import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import VisitorService from '@rebel/server/services/VisitorService'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import { Dependencies } from '@rebel/shared/context/context'
import { expectObject, nameof } from '@rebel/shared/testUtils'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { single } from '@rebel/shared/util/arrays'
import { MockProxy, mock } from 'jest-mock-extended'

let mockChatMateStateService: MockProxy<ChatMateStateService>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let mockVisitorStore: MockProxy<VisitorStore>
let visitorService: VisitorService

beforeEach(() => {
  mockChatMateStateService = mock()
  mockDateTimeHelpers = mock()
  mockVisitorStore = mock()

  visitorService = new VisitorService(new Dependencies({
    logService: mock(),
    chatMateStateService: mockChatMateStateService,
    dateTimeHelpers: mockDateTimeHelpers,
    visitorStore: mockVisitorStore
  }))

  mockChatMateStateService.getVisitorCountSemaphore.calledWith().mockReturnValue(new GroupedSemaphore())
})

describe(nameof(VisitorService, 'addVisitor'), () => {
  test('Adds the visitor to the store and cache', async () => {
    mockChatMateStateService.cacheVisitor.calledWith(expect.any(String)).mockReturnValue(true)

    await visitorService.addVisitor('ip')

    expect(mockChatMateStateService.cacheVisitor.mock.calls.length).toBe(1)
    expect(mockVisitorStore.addVisitor.mock.calls.length).toBe(1)
  })

  test('Does nothing if the visitor has already been added', async () => {
    mockChatMateStateService.cacheVisitor.calledWith(expect.any(String)).mockReturnValue(false)

    await visitorService.addVisitor('ip')

    expect(mockChatMateStateService.cacheVisitor.mock.calls.length).toBe(1)
    expect(mockVisitorStore.addVisitor.mock.calls.length).toBe(0)
  })
})

describe(nameof(VisitorService, 'getUniqueVisitorsToday'), () => {
  test('Gets the correct number of visitors', async () => {
    const startOfDay = Date.now()
    const count = 5
    mockDateTimeHelpers.getStartOfToday.calledWith().mockReturnValue(startOfDay)
    mockVisitorStore.getGroupedUniqueVisitors.calledWith(startOfDay).mockResolvedValue([{ timestamp: startOfDay, visitors: count }])

    const result = await visitorService.getUniqueVisitorsToday()

    expect(result).toEqual(count)
  })
})
