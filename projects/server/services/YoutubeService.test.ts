import { YoutubeLivestream } from '@prisma/client'
import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import YoutubeService from '@rebel/server/services/YoutubeService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import StreamerChannelStore, { PrimaryChannels } from '@rebel/server/stores/StreamerChannelStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'
import { MockProxy, mock } from 'jest-mock-extended'

const streamerId = 5
const streamerExternalChannelId = 'externalChannelId'
const liveId = 'liveId'
const livestream = cast<YoutubeLivestream>({ liveId })
const streamerYoutubeChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: streamerExternalChannelId }} })
const streamerPrimaryChannel = cast<PrimaryChannels>({ youtubeChannel: streamerYoutubeChannel })

let mockStreamerChannelStore: MockProxy<StreamerChannelStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockYoutubeApiProxyService: MockProxy<YoutubeApiProxyService>
let mockLivestreamStore: MockProxy<LivestreamStore>
let youtubeService: YoutubeService

beforeEach(() => {
  mockStreamerChannelStore = mock()
  mockChannelStore = mock()
  mockYoutubeApiProxyService = mock()
  mockLivestreamStore = mock()

  youtubeService = new YoutubeService(new Dependencies({
    streamerChannelStore: mockStreamerChannelStore,
    channelStore: mockChannelStore,
    youtubeApiProxyService: mockYoutubeApiProxyService,
    livestreamStore: mockLivestreamStore,
    logService: mock()
  }))
})

describe(nameof(YoutubeService, 'getMods'), () => {
  test('Gets the mods and internal channel ids', async () => {
    const mod1ExternalId = 'id1'
    const mod1ExternalChannelId = 'channelId1'
    const mod2ExternalId = 'id2'
    const mod2ExternalChannelId = 'channelId2'
    const modChannelId = 123
    const modChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: mod1ExternalChannelId, id: modChannelId }} })
    const otherChannel = cast<UserChannel<'twitch'>>({ platformInfo: { platform: 'twitch', channel: { twitchId: 'twitchId' }} })
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockYoutubeApiProxyService.getMods.calledWith(streamerId, streamerExternalChannelId, liveId).mockResolvedValue([
      { externalModId: mod1ExternalId, externalChannelId: mod1ExternalChannelId }, { externalModId: mod2ExternalId, externalChannelId: mod2ExternalChannelId }
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue([modChannel, otherChannel])

    const result = await youtubeService.getMods(streamerId)

    expect(result).toEqual(expectObject(result, [
      { channelId: modChannelId, externalChannelId: mod1ExternalChannelId, externalModId: mod1ExternalId },
      { channelId: null, externalChannelId: mod2ExternalChannelId, externalModId: mod2ExternalId },
    ]))
  })

  requireLivestreamAndPrimaryYoutubeChannel()
})

describe(nameof(YoutubeService, 'modYoutubeChannel'), () => {
  test('Mods the specified channel', async () => {
    const userExternalChannelId = 'userId'
    const userYoutubeChannelId = 51
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockChannelStore.getYoutubeChannelsFromChannelIds.calledWith(expectArray([userYoutubeChannelId])).mockResolvedValue(cast<UserChannel<'youtube'>[]>([{ platformInfo: { channel: { youtubeId: userExternalChannelId }}}]))

    await youtubeService.modYoutubeChannel(streamerId, userYoutubeChannelId)

    const modCall = single(mockYoutubeApiProxyService.mod.mock.calls)
    expect(modCall).toEqual<typeof modCall>([streamerId, streamerExternalChannelId, userExternalChannelId, liveId])
  })

  requireLivestreamAndPrimaryYoutubeChannel()
})

describe(nameof(YoutubeService, 'unmodYoutubeChannel'), () => {
  test('Unmods the channel if it is modded', async () => {
    const modExternalChannelId = 'otherMod'
    const userChannelId = 51
    const modChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: modExternalChannelId, id: userChannelId }} })
    const externalModId = '151j'
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockYoutubeApiProxyService.getMods.calledWith(streamerId, streamerExternalChannelId, liveId).mockResolvedValue([
      { externalModId: externalModId, externalChannelId: modExternalChannelId }
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue([modChannel])

    await youtubeService.unmodYoutubeChannel(streamerId, userChannelId)

    const unmodCall = single(mockYoutubeApiProxyService.unmod.mock.calls)
    expect(unmodCall).toEqual<typeof unmodCall>([streamerId, streamerExternalChannelId, externalModId])
  })

  test('Does not unmod the channel if it is not modded', async () => {
    const otherModExternalChannelId = 'otherMod'
    const otherModChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: otherModExternalChannelId, id: 5623 }} })
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockYoutubeApiProxyService.getMods.calledWith(streamerId, streamerExternalChannelId, liveId).mockResolvedValue([
      { externalModId: 'externalId', externalChannelId: otherModExternalChannelId }
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue([otherModChannel])

    await youtubeService.unmodYoutubeChannel(streamerId, 51)

    expect(mockYoutubeApiProxyService.unmod.mock.calls.length).toBe(0)
  })

  requireLivestreamAndPrimaryYoutubeChannel()
})

describe(nameof(YoutubeService, 'banYoutubeChannel'), () => {
  test('Bans the specified youtube channel', async () => {
    const userChannelId = 51
    const userExternalChannelId = 'externalId'
    const userChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: userExternalChannelId }} })
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockChannelStore.getYoutubeChannelsFromChannelIds.calledWith(expectArray([userChannelId])).mockResolvedValue([userChannel])

    await youtubeService.banYoutubeChannel(streamerId, userChannelId)

    const banCall = single(mockYoutubeApiProxyService.ban.mock.calls)
    expect(banCall).toEqual<typeof banCall>([streamerId, streamerExternalChannelId, userExternalChannelId, liveId])
  })

  requireLivestreamAndPrimaryYoutubeChannel()
})

describe(nameof(YoutubeService, 'timeoutYoutubeChannel'), () => {
  test('Times out the specified youtube channel', async () => {
    const timeoutDuration = 60
    const userChannelId = 51
    const userExternalChannelId = 'externalId'
    const userChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: userExternalChannelId }} })
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockChannelStore.getYoutubeChannelsFromChannelIds.calledWith(expectArray([userChannelId])).mockResolvedValue([userChannel])

    await youtubeService.timeoutYoutubeChannel(streamerId, userChannelId, timeoutDuration)

    const timeoutCall = single(mockYoutubeApiProxyService.timeout.mock.calls)
    expect(timeoutCall).toEqual<typeof timeoutCall>([streamerId, streamerExternalChannelId, userExternalChannelId, liveId, timeoutDuration])
  })

  requireLivestreamAndPrimaryYoutubeChannel()
})

describe(nameof(YoutubeService, 'unbanYoutubeChannel'), () => {
  test('Unbans the specified youtube channel', async () => {
    const userChannelId = 51
    const userExternalChannelId = 'externalId'
    const userChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: userExternalChannelId }} })
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockChannelStore.getYoutubeChannelsFromChannelIds.calledWith(expectArray([userChannelId])).mockResolvedValue([userChannel])

    await youtubeService.unbanYoutubeChannel(streamerId, userChannelId)

    const unbanCall = single(mockYoutubeApiProxyService.unban.mock.calls)
    expect(unbanCall).toEqual<typeof unbanCall>([streamerId, streamerExternalChannelId, expect.any(String)])
  })

  requireLivestreamAndPrimaryYoutubeChannel()
})

describe(nameof(YoutubeService, 'untimeoutYoutubeChannel'), () => {
  test('Times out the specified youtube channel for 0 seconds', async () => {
    const userChannelId = 51
    const userExternalChannelId = 'externalId'
    const userChannel = cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { youtubeId: userExternalChannelId }} })
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([streamerPrimaryChannel])
    mockChannelStore.getYoutubeChannelsFromChannelIds.calledWith(expectArray([userChannelId])).mockResolvedValue([userChannel])

    await youtubeService.untimeoutYoutubeChannel(streamerId, userChannelId)

    const timeoutCall = single(mockYoutubeApiProxyService.timeout.mock.calls)
    expect(timeoutCall).toEqual<typeof timeoutCall>([streamerId, streamerExternalChannelId, userExternalChannelId, liveId, 0])
  })

  requireLivestreamAndPrimaryYoutubeChannel()
})

function requireLivestreamAndPrimaryYoutubeChannel () {
  test('Throws if there is no active livestream', async () => {
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(null)

    await expect(() => youtubeService.unmodYoutubeChannel(streamerId, 123)).rejects.toThrowError(ChatMateError)
  })

  test('Throws if the streamer does not have a primary Youtube channel', async () => {
    const primaryChannels = cast<PrimaryChannels>({ youtubeChannel: null })
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue([primaryChannels])

    await expect(() => youtubeService.unmodYoutubeChannel(streamerId, 123)).rejects.toThrowError(ChatMateError)
  })
}
