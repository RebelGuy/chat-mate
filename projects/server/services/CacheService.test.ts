import { Streamer } from '@prisma/client'
import CacheService from '@rebel/server/services/CacheService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof } from '@rebel/shared/testUtils'
import { MockProxy, mock } from 'jest-mock-extended'

const mockChatMateRegisteredUserName = 'mockChatMateRegisteredUserName'
let mockStreamerStore: MockProxy<StreamerStore>
let cacheService: CacheService

beforeEach(() => {
  mockStreamerStore = mock()

  cacheService = new CacheService(new Dependencies({
    chatMateRegisteredUserName: mockChatMateRegisteredUserName,
    logService: mock(),
    streamerStore: mockStreamerStore
  }))
})

describe(nameof(CacheService, 'isChatMateStreamer'), () => {
  test('Returns true if the streamer is the official ChatMate streamer and caches result', async () => {
    const chatMateStreamer = cast<Streamer>({ id: 5 })
    mockStreamerStore.getStreamerByName.calledWith(mockChatMateRegisteredUserName).mockResolvedValue(chatMateStreamer)

    const result1 = await cacheService.isChatMateStreamer(1)
    const result2 = await cacheService.isChatMateStreamer(5)

    expect(result1).toBe(false)
    expect(result2).toBe(true)
    expect(mockStreamerStore.getStreamerByName.mock.calls.length).toBe(1)
  })
})
