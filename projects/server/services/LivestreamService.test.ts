import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LivestreamService from '@rebel/server/services/LivestreamService'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { mockGetter, nameof, single } from '@rebel/server/_test/utils'
import { mock, mockDeep, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Livestream } from '@prisma/client'

function makeMetadata (status: LiveStatus): Metadata {
  return {
    channelId: 'mock channel id',
    videoId: 'mock video id',
    channelName: 'mock channel name',
    liveStatus: status,
    title: 'mock title'
  }
}

function makeStream (start: Date | null, end: Date | null): Livestream {
  return {
    ...data.livestream1,
    start,
    end
  }
}

let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchat: MockProxy<IMasterchat>
let mockLogService: MockProxy<LogService>
let livestreamService: LivestreamService

beforeEach(() => {
  mockLivestreamStore = mock<LivestreamStore>()
  mockMasterchat = mock<IMasterchat>()
  mockLogService = mock<LogService>()

  const mockMasterchatProvider = mockDeep<MasterchatProvider>({
    get: () => mockMasterchat
  })

  // for some reason we have to use the `legacy` option, else tests will time out.
  // it seems like jest doesn't like setInterval() very much...
  jest.useFakeTimers('legacy')

  livestreamService = new LivestreamService(new Dependencies({
    livestreamStore: mockLivestreamStore,
    logService: mockLogService,
    masterchatProvider: mockMasterchatProvider
  }))
})

afterEach(() => {
  jest.clearAllTimers()
})

describe(nameof(LivestreamService, 'start'), () => {
  test('ignores if receives `not_started` status from metadata', async () => {
    mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(makeStream(null, null))
    mockMasterchat.fetchMetadata.mockResolvedValue(makeMetadata('not_started'))

    await livestreamService.start()

    expect(mockLivestreamStore.setTimes.mock.calls.length).toBe(0)
  })

  test('passes to LivestreamStore if receives `live` status from metadata', async () => {
    mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(makeStream(null, null))
    mockMasterchat.fetchMetadata.mockResolvedValue(makeMetadata('live'))

    await livestreamService.start()

    const { start, end } = single(mockLivestreamStore.setTimes.mock.calls)[0]
    expect(start).not.toBeNull()
    expect(end).toBeNull()
  })

  test('passes to LivestreamStore if receives `finished` status from metadata', async () => {
    mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(makeStream(new Date(), null))
    mockMasterchat.fetchMetadata.mockResolvedValue(makeMetadata('finished'))

    await livestreamService.start()

    const { start, end } = single(mockLivestreamStore.setTimes.mock.calls)[0]
    expect(start).not.toBeNull()
    expect(end).not.toBeNull()
  })

  test('ignores if invalid status', async () => {
    mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(makeStream(new Date(), new Date()))
    mockMasterchat.fetchMetadata.mockResolvedValue(makeMetadata('live'))

    await livestreamService.start()

    expect(mockLivestreamStore.setTimes.mock.calls.length).toBe(0)
  })

  test('updates metadata regularly', async () => {
    mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(makeStream(null, null))
    mockMasterchat.fetchMetadata.mockResolvedValue(makeMetadata('not_started'))

    await livestreamService.start()
    expect(mockMasterchat.fetchMetadata).toBeCalledTimes(1)

    // don't use `runAllTimers`, as it will run into infinite recursion
    jest.runOnlyPendingTimers()
    expect(mockMasterchat.fetchMetadata).toBeCalledTimes(2)

    jest.runOnlyPendingTimers()
    expect(mockMasterchat.fetchMetadata).toBeCalledTimes(3)
  })
})
