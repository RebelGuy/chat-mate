import { Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import DonationService from '@rebel/server/services/DonationService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LinkService from '@rebel/server/services/LinkService'
import ModService from '@rebel/server/services/rank/ModService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import RankService, { MergeResult } from '@rebel/server/services/rank/RankService'
import AccountStore, { RegisteredUserResult } from '@rebel/server/stores/AccountStore'
import DonationStore from '@rebel/server/stores/DonationStore'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import StreamerChannelStore, { PrimaryChannels } from '@rebel/server/stores/StreamerChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single, single2 } from '@rebel/shared/util/arrays'
import { addTime } from '@rebel/shared/util/datetime'
import { LinkAttemptInProgressError } from '@rebel/shared/util/error'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockAccountStore: MockProxy<AccountStore>
let mockDonationService: MockProxy<DonationService>
let mockExperienceService: MockProxy<ExperienceService>
let mockExperienceStore: MockProxy<ExperienceStore>
let mockLinkStore: MockProxy<LinkStore>
let mockModService: MockProxy<ModService>
let mockPunishmentService: MockProxy<PunishmentService>
let mockRankService: MockProxy<RankService>
let mockDonationStore: MockProxy<DonationStore>
let mockRankStore: MockProxy<RankStore>
let mockStreamerChannelStore: MockProxy<StreamerChannelStore>
let mockStreamerStore: MockProxy<StreamerStore>
let linkService: LinkService

beforeEach(() => {
  mockAccountStore = mock()
  mockDonationService = mock()
  mockExperienceService = mock()
  mockExperienceStore = mock()
  mockLinkStore = mock()
  mockModService = mock()
  mockPunishmentService = mock()
  mockRankService = mock()
  mockDonationStore = mock()
  mockRankStore = mock()
  mockStreamerChannelStore = mock()
  mockStreamerStore = mock()

  linkService = new LinkService(new Dependencies({
    logService: mock(),
    accountStore: mockAccountStore,
    donationService: mockDonationService,
    experienceService: mockExperienceService,
    experienceStore: mockExperienceStore,
    linkStore: mockLinkStore,
    modService: mockModService,
    punishmentService: mockPunishmentService,
    rankService: mockRankService,
    donationStore: mockDonationStore,
    rankStore: mockRankStore,
    streamerChannelStore: mockStreamerChannelStore,
    streamerStore: mockStreamerStore
  }))
})

describe(nameof(LinkService, 'linkUser'), () => {
  test('First-time link only relinks experience and transfers rank, but does not merge ranks nor recalculate donations or xp', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 5]
    const linkToken = 'token'

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: connectedUserIds }])

    await linkService.linkUser(defaultUserId, aggregateUserId, linkToken)

    expect(single(mockLinkStore.addLinkAttemptToLinkToken.mock.calls)).toEqual([linkToken, linkAttemptId])
    expect(single(mockLinkStore.linkUser.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single2(mockExperienceStore.invalidateSnapshots.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockExperienceStore.relinkChatExperience.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockDonationStore.relinkDonation.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockRankStore.relinkAdminUsers.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockRankService.transferRanks.mock.calls)).toEqual([defaultUserId, aggregateUserId, expect.any(String), true, expect.anything()])
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), null])
  })

  test('Second-time link relinks experience, merges ranks, and recalculates donations and xp', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 5, 6]

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: connectedUserIds }])
    mockRankService.mergeRanks.calledWith(defaultUserId, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [] })

    await linkService.linkUser(defaultUserId, aggregateUserId, 'token')

    expect(single(mockLinkStore.linkUser.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single2(mockExperienceStore.invalidateSnapshots.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockExperienceStore.relinkChatExperience.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockDonationStore.relinkDonation.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockRankStore.relinkAdminUsers.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockRankService.mergeRanks.mock.calls)).toEqual([defaultUserId, aggregateUserId, expect.anything(), expect.any(String)])
    expect(single(mockDonationService.reEvaluateDonationRanks.mock.calls)).toEqual([aggregateUserId, expect.any(String), expect.any(String)])
    expect(single(mockExperienceService.recalculateChatExperience.mock.calls)).toEqual([aggregateUserId])
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), null])
  })

  test('Fails if the maximum number of channels have been linked', async () => {
    const defaultUserId = 50
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [aggregateUserId, defaultUserId, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: connectedUserIds }])

    await expect(() => linkService.linkUser(defaultUserId, aggregateUserId, 'token')).rejects.toThrow()

    expect(single(mockLinkStore.linkUser.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single2(mockLinkStore.unlinkUser.mock.calls)).toEqual(defaultUserId)
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), expect.any(String)])
  })

  test('Mod rank external reconciliation', async () => {
    const defaultUserId1 = 5
    const defaultUserId2 = 6
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [aggregateUserId, defaultUserId1, defaultUserId2]
    const mergeResult1: MergeResult = {
      streamerId: 1,
      additions: [cast<UserRankWithRelations>({ rank: { name: 'mod' }})], // from old user to new users
      extensions: [],
      oldRanks: [cast<UserRankWithRelations>({ rank: { name: 'mod' }})],
      removals: [],
      unchanged: [],
      mergeId: ''
    }
    const mergeResult2: MergeResult = {
      streamerId: 2,
      additions: [],
      extensions: [],
      oldRanks: [],
      removals: [],
      unchanged: [cast<UserRankWithRelations>({ rank: { name: 'mod' }})], // from new users to old user
      mergeId: ''
    }

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId1, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([defaultUserId1])).mockResolvedValue([{ queriedAnyUserId: defaultUserId1, connectedChatUserIds: connectedUserIds }])
    mockRankService.mergeRanks.calledWith(defaultUserId1, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [mergeResult1, mergeResult2] })

    await linkService.linkUser(defaultUserId1, aggregateUserId, 'token')

    const calls = mockModService.setModRankExternal.mock.calls
    expect(calls.length).toBe(4)
    // the user shouldn't be unmodded because if either side of the merge was modded, the other side should also get modded.
    // we re-apply the mod rank to the existing user
    expect(calls[0]).toEqual([defaultUserId1, mergeResult1.streamerId, true])
    expect(calls[1]).toEqual([defaultUserId2, mergeResult1.streamerId, true])
    expect(calls[2]).toEqual([defaultUserId1, mergeResult2.streamerId, true])
    expect(calls[3]).toEqual([defaultUserId2, mergeResult2.streamerId, true])
  })

  test('Ban rank external reconciliation', async () => {
    const defaultUserId1 = 5
    const defaultUserId2 = 6
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [aggregateUserId, defaultUserId1, defaultUserId2]
    const mergeResult1: MergeResult = {
      streamerId: 1,
      additions: [cast<UserRankWithRelations>({ rank: { name: 'ban' }})], // from old user to new users
      extensions: [],
      oldRanks: [cast<UserRankWithRelations>({ rank: { name: 'ban' }})],
      removals: [],
      unchanged: [],
      mergeId: ''
    }
    const mergeResult2: MergeResult = {
      streamerId: 2,
      additions: [],
      extensions: [],
      oldRanks: [],
      removals: [],
      unchanged: [cast<UserRankWithRelations>({ rank: { name: 'ban' }})], // from new users to old user
      mergeId: ''
    }

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId1, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([defaultUserId1])).mockResolvedValue([{ queriedAnyUserId: defaultUserId1, connectedChatUserIds: connectedUserIds }])
    mockRankService.mergeRanks.calledWith(defaultUserId1, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [mergeResult1, mergeResult2] })

    await linkService.linkUser(defaultUserId1, aggregateUserId, 'token')

    const calls = mockPunishmentService.banUserExternal.mock.calls
    expect(calls.length).toBe(4)
    // the user shouldn't be unbanned because if either side of the merge was banned, the other side should also get banned.
    // we re-apply the ban rank to the existing user
    expect(calls[0]).toEqual([defaultUserId1, mergeResult1.streamerId, expect.any(String)])
    expect(calls[1]).toEqual([defaultUserId2, mergeResult1.streamerId, expect.any(String)])
    expect(calls[2]).toEqual([defaultUserId1, mergeResult2.streamerId, expect.any(String)])
    expect(calls[3]).toEqual([defaultUserId2, mergeResult2.streamerId, expect.any(String)])
  })

  test('Timeout rank external reconciliation', async () => {
    const defaultUserId1 = 5
    const defaultUserId2 = 6
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [aggregateUserId, defaultUserId1, defaultUserId2]
    const rank1 = 10
    const rank2 = 11
    const rank3 = 12
    const expiration = addTime(new Date(), 'seconds', 500)
    const mergeResult1: MergeResult = {
      streamerId: 1,
      additions: [cast<UserRankWithRelations>({ id: rank1, expirationTime: expiration, rank: { name: 'timeout' }})], // from old user to new users
      extensions: [],
      oldRanks: [cast<UserRankWithRelations>({ id: rank2, expirationTime: expiration, rank: { name: 'timeout' }})],
      removals: [],
      unchanged: [],
      mergeId: ''
    }
    const mergeResult2: MergeResult = {
      streamerId: 2,
      additions: [],
      extensions: [],
      oldRanks: [],
      removals: [],
      unchanged: [cast<UserRankWithRelations>({ id: rank3, expirationTime: expiration, rank: { name: 'timeout' }})], // from new users to old user
      mergeId: ''
    }

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId1, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([defaultUserId1])).mockResolvedValue([{ queriedAnyUserId: defaultUserId1, connectedChatUserIds: connectedUserIds }])
    mockRankService.mergeRanks.calledWith(defaultUserId1, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [mergeResult1, mergeResult2] })

    await linkService.linkUser(defaultUserId1, aggregateUserId, 'token')

    const timeoutCalls = mockPunishmentService.timeoutUserExternal.mock.calls
    expect(timeoutCalls.length).toBe(4)
    expect(timeoutCalls[0]).toEqual([defaultUserId1, mergeResult1.streamerId, rank1, expect.any(String), 500])
    expect(timeoutCalls[1]).toEqual([defaultUserId2, mergeResult1.streamerId, rank1, expect.any(String), 500])
    expect(timeoutCalls[2]).toEqual([defaultUserId1, mergeResult2.streamerId, rank3, expect.any(String), 500])
    expect(timeoutCalls[3]).toEqual([defaultUserId2, mergeResult2.streamerId, rank3, expect.any(String), 500])

    const untimeoutCalls = mockPunishmentService.untimeoutUserExternal.mock.calls
    expect(untimeoutCalls.length).toBe(2)
    expect(untimeoutCalls[0]).toEqual([defaultUserId1, mergeResult1.streamerId, rank2, expect.any(String)])
    expect(untimeoutCalls[1]).toEqual([defaultUserId2, mergeResult2.streamerId, rank3, expect.any(String)]) // user 2's timeout is re-applied
  })

  test('Completes the link attempt even when an error is encountered, but rolls back the link', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 5, 6]

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: connectedUserIds }])
    mockRankService.mergeRanks.calledWith(defaultUserId, aggregateUserId, expect.anything(), expect.any(String)).mockRejectedValue(new Error())

    await expect(() => linkService.linkUser(defaultUserId, aggregateUserId, 'token')).rejects.toThrow()

    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), expect.any(String)])
    expect(single(mockLinkStore.unlinkUser.mock.calls)).toEqual([defaultUserId])
  })

  test('Throws if a link attempt fails to be created', async () => {
    // e.g. another link is already in progress, or the previous one failed to complete
    const defaultUserId = 5
    const aggregateUserId = 12

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockRejectedValue(new LinkAttemptInProgressError(''))

    await expect(() => linkService.linkUser(defaultUserId, aggregateUserId, 'token')).rejects.toThrowError(LinkAttemptInProgressError)

    expect(mockLinkStore.completeLinkAttempt.mock.calls.length).toBe(0)
  })
})

describe(nameof(LinkService, 'unlinkUser'), () => {
  test('Unlinking a single user relinks the chat experience and transfers ranks if specified in options', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2

    mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getRegisteredUsers.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue(cast<RegisteredUserResult[]>([{ registeredUser: null }]))
    mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([aggregateUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: [defaultUserId] }])

    await linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true, relinkDonations: true })

    expect(single2(mockExperienceStore.invalidateSnapshots.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockExperienceStore.undoChatExperienceRelink.mock.calls)).toEqual([defaultUserId])
    expect(single(mockDonationStore.undoDonationRelink.mock.calls)).toEqual([defaultUserId])
    expect(single(mockRankService.transferRanks.mock.calls)).toEqual([aggregateUserId, defaultUserId, expect.any(String), true, expect.anything()])
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), null])
  })

  test('Unlinking a single user does not relink the chat experience or transfer ranks if not specified in options', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2

    mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getRegisteredUsers.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue(cast<RegisteredUserResult[]>([{ registeredUser: null }]))
    mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([aggregateUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: [defaultUserId] }])

    await linkService.unlinkUser(defaultUserId, { relinkChatExperience: false, transferRanks: false, relinkDonations: false })

    expect(mockExperienceStore.invalidateSnapshots.mock.calls.length).toBe(0)
    expect(mockExperienceStore.undoChatExperienceRelink.mock.calls.length).toBe(0)
    expect(mockDonationStore.undoDonationRelink.mock.calls.length).toBe(0)
    expect(mockRankService.transferRanks.mock.calls.length).toBe(0)
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), null])
  })

  test('Unlinking a user that had multiple connected users relinks the chat experience and transfers ranks if specified in options', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 6]

    mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getRegisteredUsers.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue(cast<RegisteredUserResult[]>([{ registeredUser: null }]))
    mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([aggregateUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: connectedUserIds }])

    await linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true, relinkDonations: true })

    expect(single2(mockExperienceStore.invalidateSnapshots.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockExperienceStore.undoChatExperienceRelink.mock.calls)).toEqual([defaultUserId])
    expect(single(mockDonationStore.undoDonationRelink.mock.calls)).toEqual([defaultUserId])
    expect(single(mockRankService.transferRanks.mock.calls)).toEqual([aggregateUserId, defaultUserId, expect.any(String), false, expect.anything()]) // important - keep existing ranks of the aggreagte user
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), null])
  })

  test('Completes the link attempt even when an error is encountered', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 6]

    mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getRegisteredUsers.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue(cast<RegisteredUserResult[]>([{ registeredUser: null }]))
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([aggregateUserId])).mockResolvedValue([{ queriedAnyUserId: defaultUserId, connectedChatUserIds: connectedUserIds }])
    mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
    mockRankService.transferRanks.calledWith(aggregateUserId, defaultUserId, expect.anything(), expect.any(Boolean), expect.anything()).mockRejectedValue(new Error())

    await expect(() => linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true, relinkDonations: true })).rejects.toThrow()

    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), expect.any(String)])
  })

  test('Completes the link attempt if the unlinked channel is not a primary channel of the streamer', async () => {
    const defaultUserId = 5
    const linkAttemptId = 2
    const registeredUserId = 15
    const streamerId = 51
    const primaryChannels = cast<PrimaryChannels>({ youtubeChannel: { defaultUserId: defaultUserId + 1 }})

    mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getRegisteredUsers.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue(cast<RegisteredUserResult[]>([{ registeredUser: { id: registeredUserId }}]))
    mockStreamerStore.getStreamerByRegisteredUserId.calledWith(registeredUserId).mockResolvedValue(cast<Streamer>({ id: streamerId }))
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expect.arrayContaining([streamerId])).mockResolvedValue([primaryChannels])

    await linkService.unlinkUser(defaultUserId, { relinkChatExperience: false, transferRanks: false, relinkDonations: false })

    expect(single2(mockLinkStore.unlinkUser.mock.calls)).toEqual(defaultUserId)
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), null])
  })

  test('Throws if the unlinked channel is a primary channel of the streamer', async () => {
    const defaultUserId = 5
    const linkAttemptId = 2
    const registeredUserId = 15
    const streamerId = 51
    const primaryChannels = cast<PrimaryChannels>({ youtubeChannel: { defaultUserId: defaultUserId }})

    mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getRegisteredUsers.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue(cast<RegisteredUserResult[]>([{ registeredUser: { id: registeredUserId }}]))
    mockStreamerStore.getStreamerByRegisteredUserId.calledWith(registeredUserId).mockResolvedValue(cast<Streamer>({ id: streamerId }))
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expect.arrayContaining([streamerId])).mockResolvedValue([primaryChannels])

    await expect(() => linkService.unlinkUser(defaultUserId, { relinkChatExperience: false, transferRanks: false, relinkDonations: false })).rejects.toThrow()

    expect(mockLinkStore.unlinkUser.mock.calls.length).toBe(0)
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), expect.any(String)])
  })

  test('Throws if a link attempt fails to be created', async () => {
    // e.g. another link is already in progress, or the previous one failed to complete
    const defaultUserId = 5

    mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId,).mockRejectedValue(new LinkAttemptInProgressError(''))

    await expect(() => linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true, relinkDonations: true })).rejects.toThrowError(LinkAttemptInProgressError)

    expect(mockLinkStore.completeLinkAttempt.mock.calls.length).toBe(0)
  })
})
