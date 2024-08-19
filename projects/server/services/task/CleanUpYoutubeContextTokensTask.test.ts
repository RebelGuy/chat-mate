import CleanUpYoutubeContextTokensTask from '@rebel/server/services/task/CleanUpYoutubeContextTokensTask'
import ChatStore from '@rebel/server/stores/ChatStore'
import { Dependencies } from '@rebel/shared/context/context'
import { expectArray, nameof } from '@rebel/shared/testUtils'
import { NO_OP } from '@rebel/shared/util/typescript'
import { MockProxy, mock } from 'jest-mock-extended'

let mockChatStore: MockProxy<ChatStore>
let task: CleanUpYoutubeContextTokensTask

beforeEach(() => {
  mockChatStore = mock()

  task = new CleanUpYoutubeContextTokensTask(new Dependencies({
    chatStore: mockChatStore
  }))
})

describe(nameof(CleanUpYoutubeContextTokensTask, 'execute'), () => {
  test('Deletes context tokens for streamers', async () => {
    mockChatStore.getChatWithContextToken.calledWith().mockResolvedValue([
      { streamerId: 1, youtubeChannelId: 1, id: 1 }, // should be deleted
      { streamerId: 1, youtubeChannelId: 1, id: 2 },
      { streamerId: 1, youtubeChannelId: 2, id: 3 }, // should be deleted
      { streamerId: 1, youtubeChannelId: 2, id: 4 },
      { streamerId: 1, youtubeChannelId: 3, id: 5 },
      { streamerId: 2, youtubeChannelId: 1, id: 6 }, // should be deleted
      { streamerId: 2, youtubeChannelId: 1, id: 7 },
      { streamerId: 2, youtubeChannelId: 2, id: 8 }
    ])

    await task.execute(NO_OP)

    const calls = mockChatStore.deleteContextTokens.mock.calls
    expect(calls).toEqual<typeof calls>([
      [expectArray([1, 3])],
      [expectArray([6])]
    ])
  })

  test('Does not attempt to delete tokens if all tokens belong to the latest message of a channel', async () => {
    mockChatStore.getChatWithContextToken.calledWith().mockResolvedValue([
      { streamerId: 1, youtubeChannelId: 1, id: 1 },
      { streamerId: 1, youtubeChannelId: 2, id: 2 },
      { streamerId: 2, youtubeChannelId: 1, id: 3 }
    ])

    await task.execute(NO_OP)

    expect(mockChatStore.deleteContextTokens.mock.calls.length).toBe(0)
  })
})
