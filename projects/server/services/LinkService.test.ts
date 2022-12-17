import { Dependencies } from '@rebel/server/context/context'
import DonationService from '@rebel/server/services/DonationService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LinkService from '@rebel/server/services/LinkService'
import ModService from '@rebel/server/services/rank/ModService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import RankService, { MergeResult } from '@rebel/server/services/rank/RankService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { single } from '@rebel/server/util/arrays'
import { addTime } from '@rebel/server/util/datetime'
import { LinkAttemptInProgressError } from '@rebel/server/util/error'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockAccountStore: MockProxy<AccountStore>
let mockDonationService: MockProxy<DonationService>
let mockExperienceService: MockProxy<ExperienceService>
let mockExperienceStore: MockProxy<ExperienceStore>
let mockLinkStore: MockProxy<LinkStore>
let mockModService: MockProxy<ModService>
let mockPunishmentService: MockProxy<PunishmentService>
let mockRankService: MockProxy<RankService>
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

  linkService = new LinkService(new Dependencies({
    logService: mock(),
    accountStore: mockAccountStore,
    donationService: mockDonationService,
    experienceService: mockExperienceService,
    experienceStore: mockExperienceStore,
    linkStore: mockLinkStore,
    modService: mockModService,
    punishmentService: mockPunishmentService,
    rankService: mockRankService
  }))
})

describe(nameof(LinkService, 'linkUser'), () => {
  test('First-time link only relinks experience and transfers rank, but does not merge ranks nor recalculate donations or xp', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 5]

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue(connectedUserIds)

    await linkService.linkUser(defaultUserId, aggregateUserId)

    expect(single(mockLinkStore.linkUser.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockExperienceStore.relinkChatExperience.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockRankService.transferRanks.mock.calls)).toEqual([defaultUserId, aggregateUserId, expect.any(String), true, expect.anything()])
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), null])
  })

  test('Second-time link relinks experience, merges ranks, and recalculates donations and xp', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 5, 6]

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue(connectedUserIds)
    mockRankService.mergeRanks.calledWith(defaultUserId, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [] })

    await linkService.linkUser(defaultUserId, aggregateUserId)

    expect(single(mockLinkStore.linkUser.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockExperienceStore.relinkChatExperience.mock.calls)).toEqual([defaultUserId, aggregateUserId])
    expect(single(mockRankService.mergeRanks.mock.calls)).toEqual([defaultUserId, aggregateUserId, expect.anything(), expect.any(String)])
    expect(single(mockDonationService.reEvaluateDonationRanks.mock.calls)).toEqual([aggregateUserId, expect.any(String), expect.any(String)])
    expect(single(mockExperienceService.recalculateChatExperience.mock.calls)).toEqual([aggregateUserId])
    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), null])
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
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId1).mockResolvedValue(connectedUserIds)
    mockRankService.mergeRanks.calledWith(defaultUserId1, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [mergeResult1, mergeResult2] })

    await linkService.linkUser(defaultUserId1, aggregateUserId)

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
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId1).mockResolvedValue(connectedUserIds)
    mockRankService.mergeRanks.calledWith(defaultUserId1, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [mergeResult1, mergeResult2] })

    await linkService.linkUser(defaultUserId1, aggregateUserId)

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
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId1).mockResolvedValue(connectedUserIds)
    mockRankService.mergeRanks.calledWith(defaultUserId1, aggregateUserId, expect.anything(), expect.any(String)).mockResolvedValue({ warnings: 0, individualResults: [mergeResult1, mergeResult2] })

    await linkService.linkUser(defaultUserId1, aggregateUserId)

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

  test('Completes the link attempt even when an error is encountered', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkAttemptId = 2
    const connectedUserIds = [12, 5, 6]

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockResolvedValue(linkAttemptId)
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue(connectedUserIds)
    mockRankService.mergeRanks.calledWith(defaultUserId, aggregateUserId, expect.anything(), expect.any(String)).mockRejectedValue(new Error())

    await expect(() => linkService.linkUser(defaultUserId, aggregateUserId)).rejects.toThrow()

    expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), expect.any(String)])
  })

  test('Throws if a link attempt fails to be created', async () => {
    // e.g. another link is already in progress, or the previous one failed to complete
    const defaultUserId = 5
    const aggregateUserId = 12

    mockLinkStore.startLinkAttempt.calledWith(defaultUserId, aggregateUserId).mockRejectedValue(new LinkAttemptInProgressError(''))

    await expect(() => linkService.linkUser(defaultUserId, aggregateUserId)).rejects.toThrowError(LinkAttemptInProgressError)

    expect(mockLinkStore.completeLinkAttempt.mock.calls.length).toBe(0)
  })

  describe(nameof(LinkService, 'unlinkUser'), () => {
    test('Unlinking a single user relinks the chat experience and transfers ranks if specified in options', async () => {
      const defaultUserId = 5
      const aggregateUserId = 12
      const linkAttemptId = 2

      mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
      mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
      mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue([defaultUserId])

      await linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true })

      expect(single(mockExperienceStore.undoChatExperienceRelink.mock.calls)).toEqual([defaultUserId])
      expect(single(mockRankService.transferRanks.mock.calls)).toEqual([aggregateUserId, defaultUserId, expect.any(String), true, expect.anything()])
      expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), null])
    })

    test('Unlinking a single user does not relink the chat experience or transfer ranks if not specified in options', async () => {
      const defaultUserId = 5
      const aggregateUserId = 12
      const linkAttemptId = 2

      mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
      mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
      mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue([defaultUserId])

      await linkService.unlinkUser(defaultUserId, { relinkChatExperience: false, transferRanks: false })

      expect(mockExperienceStore.undoChatExperienceRelink.mock.calls.length).toBe(0)
      expect(mockRankService.transferRanks.mock.calls.length).toBe(0)
      expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), null])
    })

    test('Unlinking a user that had multiple connected users relinks the chat experience and transfers ranks if specified in options', async () => {
      const defaultUserId = 5
      const aggregateUserId = 12
      const linkAttemptId = 2
      const connectedUserIds = [12, 6]

      mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
      mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
      mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue(connectedUserIds)

      await linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true })

      expect(single(mockExperienceStore.undoChatExperienceRelink.mock.calls)).toEqual([defaultUserId])
      expect(single(mockRankService.transferRanks.mock.calls)).toEqual([aggregateUserId, defaultUserId, expect.any(String), false, expect.anything()]) // important - keep existing ranks of the aggreagte user
      expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([linkAttemptId, expect.anything(), null])
    })

    test('Completes the link attempt even when an error is encountered', async () => {
      const defaultUserId = 5
      const aggregateUserId = 12
      const linkAttemptId = 2
      const connectedUserIds = [12, 6]

      mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId).mockResolvedValue(linkAttemptId)
      mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue(connectedUserIds)
      mockLinkStore.unlinkUser.calledWith(defaultUserId).mockResolvedValue(aggregateUserId)
      mockRankService.transferRanks.calledWith(aggregateUserId, defaultUserId, expect.anything(), expect.any(Boolean), expect.anything()).mockRejectedValue(new Error())

      await expect(() => linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true })).rejects.toThrow()

      expect(single(mockLinkStore.completeLinkAttempt.mock.calls)).toEqual([expect.any(Number), expect.anything(), expect.any(String)])
    })

    test('Throws if a link attempt fails to be created', async () => {
      // e.g. another link is already in progress, or the previous one failed to complete
      const defaultUserId = 5

      mockLinkStore.startUnlinkAttempt.calledWith(defaultUserId,).mockRejectedValue(new LinkAttemptInProgressError(''))

      await expect(() => linkService.unlinkUser(defaultUserId, { relinkChatExperience: true, transferRanks: true })).rejects.toThrowError(LinkAttemptInProgressError)

      expect(mockLinkStore.completeLinkAttempt.mock.calls.length).toBe(0)
    })
  })
})
