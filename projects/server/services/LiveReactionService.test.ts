import { YTEmoji } from '@rebel/masterchat'
import { PartialProcessedEmojiChatMessage } from '@rebel/server/models/chat'
import EmojiService from '@rebel/server/services/EmojiService'
import EventDispatchService, { EVENT_PUBLIC_CHAT_MATE_EVENT_LIVE_REACTION } from '@rebel/server/services/EventDispatchService'
import LiveReactionService from '@rebel/server/services/LiveReactionService'
import LiveReactionStore from '@rebel/server/stores/LiveReactionStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, expectObject, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { MockProxy, mock } from 'jest-mock-extended'

const streamerId = 5
const unicodeEmoji = 'emoji'
const reactionCount = 2

let mockEmojiService: MockProxy<EmojiService>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockLiveReactionStore: MockProxy<LiveReactionStore>
let liveReactionService: LiveReactionService

beforeEach(() => {
  mockEmojiService = mock()
  mockEventDispatchService = mock()
  mockLiveReactionStore = mock()

  liveReactionService = new LiveReactionService(new Dependencies({
    emojiService: mockEmojiService,
    eventDispatchService: mockEventDispatchService,
    liveReactionStore: mockLiveReactionStore,
    logService: mock()
  }))
})

describe(nameof(LiveReactionService, 'onLiveReaction'), () => {
  test('Saves the reaction to the db and emits an event', async () => {
    const ytEmoji = cast<YTEmoji>({ emojiId: 'emoji', image: { thumbnails: [{ url: 'url' }]} })
    mockEmojiService.parseEmojiByUnicode.calledWith(unicodeEmoji).mockReturnValue(ytEmoji)

    const emojiId = 124
    mockEmojiService.processEmoji.calledWith(expect.anything()).mockResolvedValue(cast<PartialProcessedEmojiChatMessage>({ emojiId }))

    await liveReactionService.onLiveReaction(streamerId, unicodeEmoji, reactionCount)

    const liveReactionStoreCall = single(mockLiveReactionStore.addLiveReaction.mock.calls)
    expect(liveReactionStoreCall).toEqual(expectObject(liveReactionStoreCall, [streamerId, emojiId, reactionCount]))

    const eventDispatchServiceCall = single(mockEventDispatchService.addData.mock.calls)
    expect(eventDispatchServiceCall).toEqual(expectObject(eventDispatchServiceCall, [EVENT_PUBLIC_CHAT_MATE_EVENT_LIVE_REACTION, { streamerId, emojiId, reactionCount }]))
  })

  test(`Does nothing if the emoji can't be parsed`, async () => {
    mockEmojiService.parseEmojiByUnicode.calledWith(unicodeEmoji).mockReturnValue(null)

    await liveReactionService.onLiveReaction(streamerId, unicodeEmoji, reactionCount)

    expect(mockLiveReactionStore.addLiveReaction.mock.calls.length).toBe(0)
    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })
})
