import { RegisteredUser, Streamer } from '@prisma/client'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import ChannelService, { ExternalRankEventData } from '@rebel/server/services/ChannelService'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import ModService from '@rebel/server/services/rank/ModService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import AccountStore from '@rebel/server/stores/AccountStore'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { MockProxy, mock } from 'jest-mock-extended'

const streamerId = 5
const channelName = 'testChannel'
const moderatorChannelName = 'testModeratorChannel'
const primaryUserId = 18
const channelId = 875
const moderatorPrimaryUserId = 15

let mockPunishmentService: MockProxy<PunishmentService>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let mockChannelService: MockProxy<ChannelService>
let mockAccountStore: MockProxy<AccountStore>
let mockModService: MockProxy<ModService>
let mockStreamerStore: MockProxy<StreamerStore>
let externalRankEventService: ExternalRankEventService

beforeEach(() => {
  mockPunishmentService = mock()
  mockDateTimeHelpers = mock()
  mockChannelService = mock()
  mockAccountStore = mock()
  mockModService = mock()
  mockStreamerStore = mock()

  externalRankEventService = new ExternalRankEventService(new Dependencies({
    logService: mock(),
    punishmentService: mockPunishmentService,
    dateTimeHelpers: mockDateTimeHelpers,
    channelService: mockChannelService,
    accountStore: mockAccountStore,
    modService: mockModService,
    streamerStore: mockStreamerStore
  }))
})

describe(nameof(ExternalRankEventService, 'onTwitchChannelBanned'), () => {
  const reason = 'test reason'
  const now = Date.now()
  const endTime = now + 10_000

  test('Returns early if primary user not found', async () => {
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(null)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, null)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Does not ban the user if they are already banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'ban' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, null)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Bans the user if they are not banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, null)

    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
    const banArgs = single(mockPunishmentService.banUser.mock.calls)
    expect(banArgs).toEqual<typeof banArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, reason, expectObject({ twitchChannelId: channelId })])
  })

  test('Does not time the user out if they are already timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'timeout' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, endTime)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Times the user out if they are not timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)
    mockDateTimeHelpers.ts.calledWith().mockReturnValue(now)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, endTime)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    const timeoutArgs = single(mockPunishmentService.timeoutUser.mock.calls)
    expect(timeoutArgs).toEqual<typeof timeoutArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, reason, 10, expectObject({ twitchChannelId: channelId })])
  })
})

describe(nameof(ExternalRankEventService, 'onTwitchChannelModded'), () => {
  test('Returns early if primary user not found', async () => {
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, null, 'administration').mockResolvedValue(null)

    await externalRankEventService.onTwitchChannelModded(streamerId, channelName)

    expect(mockModService.setModRank).not.toBeCalled()
  })

  test('Does not mod the user if they are already modded internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mod' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId: null }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, null, 'administration').mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelModded(streamerId, channelName)

    expect(mockModService.setModRank).not.toBeCalled()
  })

  test('Mods the user if they are not modded internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'famous' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId: null }
    const registeredUserId = 123
    const streamerPrimaryUserId = 265
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, null, 'administration').mockResolvedValue(data)
    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(cast<Streamer>({ registeredUserId }))
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray([registeredUserId])).mockResolvedValue(cast<RegisteredUser[]>([{ aggregateChatUserId: streamerPrimaryUserId }]))

    await externalRankEventService.onTwitchChannelModded(streamerId, channelName)

    const modArgs = single(mockModService.setModRank.mock.calls)
    expect(modArgs).toEqual<typeof modArgs>([primaryUserId, streamerId, streamerPrimaryUserId, true, null, expectObject({ twitchChannelId: channelId })])
  })
})

describe(nameof(ExternalRankEventService, 'onTwitchChannelUnbanned'), () => {
  test('Returns early if primary user not found', async () => {
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(null)

    await externalRankEventService.onTwitchChannelUnbanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.unbanUser).not.toBeCalled()
    expect(mockPunishmentService.untimeoutUser).not.toBeCalled()
  })

  test('Does not unban or untimeout the user if they are not banned or timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelUnbanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.unbanUser).not.toBeCalled()
    expect(mockPunishmentService.untimeoutUser).not.toBeCalled()
  })

  test('Unbans and untimeouts the user if they are banned or timed out internally', async () => {
    const rank1 = cast<UserRankWithRelations>({ rank: { name: 'ban' } })
    const rank2 = cast<UserRankWithRelations>({ rank: { name: 'timeout' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank1, rank2], moderatorPrimaryUserId }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelUnbanned(streamerId, channelName, moderatorChannelName)

    const unbanArgs = single(mockPunishmentService.unbanUser.mock.calls)
    const untimeoutArgs = single(mockPunishmentService.untimeoutUser.mock.calls)
    expect(unbanArgs).toEqual<typeof unbanArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, null, expectObject({ twitchChannelId: channelId })])
    expect(untimeoutArgs).toEqual<typeof untimeoutArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, null, expectObject({ twitchChannelId: channelId })])
  })
})

describe(nameof(ExternalRankEventService, 'onTwitchChannelUnmodded'), () => {
  test('Returns early if primary user not found', async () => {
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, null, 'administration').mockResolvedValue(null)

    await externalRankEventService.onTwitchChannelUnmodded(streamerId, channelName)

    expect(mockModService.setModRank).not.toBeCalled()
  })

  test('Does not unmod the user if they are not modded internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'famous' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId: null }
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, null, 'administration').mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelUnmodded(streamerId, channelName)

    expect(mockModService.setModRank).not.toBeCalled()
  })

  test('Mods the user if they are not modded internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mod' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId: null }
    const registeredUserId = 123
    const streamerPrimaryUserId = 265
    mockChannelService.getTwitchDataForExternalRankEvent.calledWith(streamerId, channelName, null, 'administration').mockResolvedValue(data)
    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(cast<Streamer>({ registeredUserId }))
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray([registeredUserId])).mockResolvedValue(cast<RegisteredUser[]>([{ aggregateChatUserId: streamerPrimaryUserId }]))

    await externalRankEventService.onTwitchChannelUnmodded(streamerId, channelName)

    const modArgs = single(mockModService.setModRank.mock.calls)
    expect(modArgs).toEqual<typeof modArgs>([primaryUserId, streamerId, streamerPrimaryUserId, false, null, expectObject({ twitchChannelId: channelId })])
  })
})

describe(nameof(ExternalRankEventService, 'onYoutubeChannelBanned'), () => {
  test('Returns early if primary user not found', async () => {
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(null)

    await externalRankEventService.onYoutubeChannelBanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.banUser).not.toBeCalled()
  })

  test('Does not ban user if they are already banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'ban' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onYoutubeChannelBanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.banUser).not.toBeCalled()
  })

  test('Bans user if they are not banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onYoutubeChannelBanned(streamerId, channelName, moderatorChannelName)

    const call = single(mockPunishmentService.banUser.mock.calls)
    expect(call).toEqual<typeof call>([primaryUserId, streamerId, moderatorPrimaryUserId, null, expectObject({ youtubeChannelId: channelId })])
  })
})

describe(nameof(ExternalRankEventService, 'onYoutubeChannelUnbanned'), () => {
  test('Returns early if primary user not found', async () => {
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(null)

    await externalRankEventService.onYoutubeChannelUnbanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.unbanUser).not.toBeCalled()
  })

  test('Does not unban user if they are not banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onYoutubeChannelUnbanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.unbanUser).not.toBeCalled()
  })

  test('Unbans user if they are banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'ban' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onYoutubeChannelUnbanned(streamerId, channelName, moderatorChannelName)

    const call = single(mockPunishmentService.unbanUser.mock.calls)
    expect(call).toEqual<typeof call>([primaryUserId, streamerId, moderatorPrimaryUserId, null, expectObject({ youtubeChannelId: channelId })])
  })
})

describe(nameof(ExternalRankEventService, 'onYoutubeChannelTimedOut'), () => {
  const timeoutDuration = 60

  test('Returns early if primary user not found', async () => {
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(null)

    await externalRankEventService.onYoutubeChannelTimedOut(streamerId, channelName, moderatorChannelName, timeoutDuration)

    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Does not timeout the user if they are already timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'timeout' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onYoutubeChannelTimedOut(streamerId, channelName, moderatorChannelName, timeoutDuration)

    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Times out the user if they are not already timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: ExternalRankEventData = { primaryUserId, channelId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockChannelService.getYoutubeDataForExternalRankEvent.calledWith(streamerId, channelName, moderatorChannelName, 'punishment').mockResolvedValue(data)

    await externalRankEventService.onYoutubeChannelTimedOut(streamerId, channelName, moderatorChannelName, timeoutDuration)

    const call = single(mockPunishmentService.timeoutUser.mock.calls)
    expect(call).toEqual<typeof call>([primaryUserId, streamerId, moderatorPrimaryUserId, null, timeoutDuration, expectObject({ youtubeChannelId: channelId })])
  })
})
