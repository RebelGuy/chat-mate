import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import VisitorHelpers from '@rebel/server/helpers/VisitorHelpers'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import VisitorService from '@rebel/server/services/VisitorService'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { MockProxy, mock } from 'jest-mock-extended'

let mockChatMateStateService: MockProxy<ChatMateStateService>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let mockVisitorStore: MockProxy<VisitorStore>
let mockVisitorHelpers: MockProxy<VisitorHelpers>
let visitorService: VisitorService

beforeEach(() => {
  mockChatMateStateService = mock()
  mockDateTimeHelpers = mock()
  mockVisitorStore = mock()
  mockVisitorHelpers = mock()

  visitorService = new VisitorService(new Dependencies({
    logService: mock(),
    chatMateStateService: mockChatMateStateService,
    dateTimeHelpers: mockDateTimeHelpers,
    visitorStore: mockVisitorStore,
    visitorHelpers: mockVisitorHelpers
  }))

  mockChatMateStateService.getVisitorCountSemaphore.calledWith().mockReturnValue(new GroupedSemaphore())
})

describe(nameof(VisitorService, 'addVisitor'), () => {
  const now = new Date()
  const timeString = 'timeString'

  beforeEach(() => {
    mockDateTimeHelpers.now.calledWith().mockReturnValue(now)
    mockVisitorHelpers.getTimeString.calledWith(now).mockReturnValue(timeString)
  })

  test('Adds the visitor to the store and cache', async () => {
    mockChatMateStateService.cacheVisitor.calledWith(expect.any(String), timeString).mockReturnValue(true)

    await visitorService.addVisitor('ip')

    expect(mockChatMateStateService.cacheVisitor.mock.calls.length).toBe(1)
    expect(mockVisitorStore.addVisitor.mock.calls.length).toBe(1)
  })

  test('Does nothing if the visitor has already been added', async () => {
    mockChatMateStateService.cacheVisitor.calledWith(expect.any(String), timeString).mockReturnValue(false)

    await visitorService.addVisitor('ip')

    expect(mockChatMateStateService.cacheVisitor.mock.calls.length).toBe(1)
    expect(mockVisitorStore.addVisitor.mock.calls.length).toBe(0)
  })
})
