import { YoutubeChannelStreamerInfo } from '@prisma/client'
import ChannelEventService from '@rebel/server/services/ChannelEventService'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof } from '@rebel/shared/testUtils'
import { MockProxy, mock } from 'jest-mock-extended'

const streamerId = 15
const youtubeChannelId = 8

let mockChannelStore: MockProxy<ChannelStore>
let mockExternalRankEventService: MockProxy<ExternalRankEventService>
let channelEventService: ChannelEventService

beforeEach(() => {
  mockChannelStore = mock()
  mockExternalRankEventService = mock()

  channelEventService = new ChannelEventService(new Dependencies({
    channelStore: mockChannelStore,
    externalRankEventService: mockExternalRankEventService,
    logService: mock()
  }))
})

describe(nameof(ChannelEventService, 'checkYoutubeChannelForModEvent'), () => {
  test('Does nothing if the channel only has one info data point', async () => {
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, youtubeChannelId, 2).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{}]))

    await channelEventService.checkYoutubeChannelForModEvent(streamerId, youtubeChannelId)

    expect(mockExternalRankEventService.onYoutubeChannelModded).not.toBeCalled()
    expect(mockExternalRankEventService.onYoutubeChannelUnmodded).not.toBeCalled()
  })

  test(`Does nothing if the moderator flag hasn't changed`, async () => {
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, youtubeChannelId, 2).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{ isModerator: true }, { isModerator: true }]))

    await channelEventService.checkYoutubeChannelForModEvent(streamerId, youtubeChannelId)

    expect(mockExternalRankEventService.onYoutubeChannelModded).not.toBeCalled()
    expect(mockExternalRankEventService.onYoutubeChannelUnmodded).not.toBeCalled()
  })

  test(`Mods the user`, async () => {
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, youtubeChannelId, 2).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{ isModerator: true }, { isModerator: false }]))

    await channelEventService.checkYoutubeChannelForModEvent(streamerId, youtubeChannelId)

    expect(mockExternalRankEventService.onYoutubeChannelModded).toBeCalled()
    expect(mockExternalRankEventService.onYoutubeChannelUnmodded).not.toBeCalled()
  })

  test(`Unmods the user`, async () => {
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, youtubeChannelId, 2).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{ isModerator: false }, { isModerator: true }]))

    await channelEventService.checkYoutubeChannelForModEvent(streamerId, youtubeChannelId)

    expect(mockExternalRankEventService.onYoutubeChannelModded).not.toBeCalled()
    expect(mockExternalRankEventService.onYoutubeChannelUnmodded).toBeCalled()
  })
})
