import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import StreamerChannelService, { TwitchRankEventData } from '@rebel/server/services/StreamerChannelService'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { MockProxy, mock } from 'jest-mock-extended'

const streamerId = 5
const channelName = 'testChannel'
const moderatorChannelName = 'testModeratorChannel'
const primaryUserId = 18
const moderatorPrimaryUserId = 15

let mockStreamerChannelService: MockProxy<StreamerChannelService>
let mockPunishmentService: MockProxy<PunishmentService>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let externalRankEventService: ExternalRankEventService

beforeEach(() => {
  mockStreamerChannelService = mock()
  mockPunishmentService = mock()
  mockDateTimeHelpers = mock()

  externalRankEventService = new ExternalRankEventService(new Dependencies({
    logService: mock(),
    streamerChannelService: mockStreamerChannelService,
    punishmentService: mockPunishmentService,
    dateTimeHelpers: mockDateTimeHelpers
  }))
})

describe(nameof(ExternalRankEventService, 'onTwitchChannelBanned'), () => {
  const reason = 'test reason'
  const now = Date.now()
  const endTime = now + 10_000

  test('Returns early if primary user not found', async () => {
    const data: TwitchRankEventData = { primaryUserId: null, ranksForUser: [], moderatorPrimaryUserId: null }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, null)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Does not ban the user if they are already banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'ban' } })
    const data: TwitchRankEventData = { primaryUserId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, null)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Bans the user if they are not banned internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: TwitchRankEventData = { primaryUserId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, null)

    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
    const banArgs = single(mockPunishmentService.banUser.mock.calls)
    expect(banArgs).toEqual<typeof banArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, reason])
  })

  test('Does not time the user out if they are already timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'timeout' } })
    const data: TwitchRankEventData = { primaryUserId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, endTime)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    expect(mockPunishmentService.timeoutUser).not.toBeCalled()
  })

  test('Times the user out if they are not timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: TwitchRankEventData = { primaryUserId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)
    mockDateTimeHelpers.ts.calledWith().mockReturnValue(now)

    await externalRankEventService.onTwitchChannelBanned(streamerId, channelName, moderatorChannelName, reason, endTime)

    expect(mockPunishmentService.banUser).not.toBeCalled()
    const timeoutArgs = single(mockPunishmentService.timeoutUser.mock.calls)
    expect(timeoutArgs).toEqual<typeof timeoutArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, reason, 10])
  })
})

describe(nameof(ExternalRankEventService, 'onTwitchChannelUnbanned'), () => {
  test('Returns early if primary user not found', async () => {
    const data: TwitchRankEventData = { primaryUserId: null, ranksForUser: [], moderatorPrimaryUserId: null }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelUnbanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.unbanUser).not.toBeCalled()
    expect(mockPunishmentService.untimeoutUser).not.toBeCalled()
  })

  test('Does not unban or untimeout the user if they are not banned or timed out internally', async () => {
    const rank = cast<UserRankWithRelations>({ rank: { name: 'mute' } })
    const data: TwitchRankEventData = { primaryUserId, ranksForUser: [rank], moderatorPrimaryUserId }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelUnbanned(streamerId, channelName, moderatorChannelName)

    expect(mockPunishmentService.unbanUser).not.toBeCalled()
    expect(mockPunishmentService.untimeoutUser).not.toBeCalled()
  })

  test('Unbans and untimeouts the user if they are banned or timed out internally', async () => {
    const rank1 = cast<UserRankWithRelations>({ rank: { name: 'ban' } })
    const rank2 = cast<UserRankWithRelations>({ rank: { name: 'timeout' } })
    const data: TwitchRankEventData = { primaryUserId, ranksForUser: [rank1, rank2], moderatorPrimaryUserId }
    mockStreamerChannelService.getDataForTwitchRankEvent.calledWith(streamerId, channelName, moderatorChannelName).mockResolvedValue(data)

    await externalRankEventService.onTwitchChannelUnbanned(streamerId, channelName, moderatorChannelName)

    const unbanArgs = single(mockPunishmentService.unbanUser.mock.calls)
    const untimeoutArgs = single(mockPunishmentService.untimeoutUser.mock.calls)
    expect(unbanArgs).toEqual<typeof unbanArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, null])
    expect(untimeoutArgs).toEqual<typeof untimeoutArgs>([primaryUserId, streamerId, moderatorPrimaryUserId, null])
  })
})
