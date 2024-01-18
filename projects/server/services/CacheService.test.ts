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

describe(nameof(CacheService, 'chatMateStreamerId'), () => {
  test('Returns true if the streamer is the official ChatMate streamer and caches result', async () => {
    const chatMateStreamer = cast<Streamer>({ id: 5 })
    mockStreamerStore.getStreamerByName.calledWith(mockChatMateRegisteredUserName).mockResolvedValue(chatMateStreamer)

    const result1 = await cacheService.chatMateStreamerId.resolve()
    const result2 = await cacheService.chatMateStreamerId.resolve()

    expect(result1).toBe(chatMateStreamer.id)
    expect(result2).toBe(chatMateStreamer.id)
    expect(mockStreamerStore.getStreamerByName.mock.calls.length).toBe(1)
  })
})
