import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import DonationHelpers, { DonationAmount } from '@rebel/server/helpers/DonationHelpers'
import DonationService from '@rebel/server/services/DonationService'
import DonationStore from '@rebel/server/stores/DonationStore'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { cast, expectArray, expectObject, nameof } from '@rebel/server/_test/utils'
import { any, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { single, single2 } from '@rebel/server/util/arrays'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'

let mockDonationStore: MockProxy<DonationStore>
let mockDonationHelpers: MockProxy<DonationHelpers>
let mockRankStore: MockProxy<RankStore>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let donationService: DonationService

beforeEach(() => {
  mockDonationStore = mock()
  mockDonationHelpers = mock()
  mockRankStore = mock()
  mockDateTimeHelpers = mock()

  donationService = new DonationService(new Dependencies({
    donationStore: mockDonationStore,
    donationHelpers: mockDonationHelpers,
    rankStore: mockRankStore,
    dateTimeHelpers: mockDateTimeHelpers
  }))
})

describe(nameof(DonationService, 'linkUserToDonation'), () => {
  test('Links the user to the donation and adds/extends the donation user-ranks that the user is eligible for', async () => {
    const donationId = 2
    const userId = 2
    const time = new Date()
    const linkedDonation = cast<Donation>({ })
    const allDonations = cast<Donation[]>([
      { time: data.time1, amount: 1 },
      { time: data.time2, amount: 2 },
      { time: data.time3, amount: 3 }
    ])

    // user is currently donator, and eligible for donator and supporter
    const ranks = cast<UserRankWithRelations[]>([{ id: 20, rank: { name: 'donator' } }])
    mockDateTimeHelpers.now.mockReturnValue(time)
    mockDonationStore.getDonationsByUserId.calledWith(userId).mockResolvedValue(allDonations)
    mockRankStore.getUserRanks.calledWith(expectArray<number>([userId])).mockResolvedValue([{ userId, ranks }])
    mockDonationHelpers.isEligibleForDonator
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(true)
    mockDonationHelpers.isEligibleForSupporter
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(true)
    mockDonationHelpers.isEligibleForMember
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(false)

    await donationService.linkUserToDonation(donationId, userId)

    expect(mockDonationStore.linkUserToDonation).toBeCalledWith(donationId, userId, time)

    // only two rank changes should have been made:
    const providedUpdateArgs = single(mockRankStore.updateRankExpiration.mock.calls)
    expect(providedUpdateArgs).toEqual<typeof providedUpdateArgs>([ranks[0].id, expect.anything()])
    const providedCreateArgs = single2(mockRankStore.addUserRank.mock.calls)
    expect(providedCreateArgs).toEqual(expectObject<AddUserRankArgs>({ rank: 'supporter', time: time }))
    expect(mockRankStore.removeUserRank).not.toHaveBeenCalled()
  })
})

describe(nameof(DonationService, 'unlinkUserFromDonation'), () => {
  test('', async () => {
    const donationId = 2
    const userId = 2
    const unlinkedDonation = cast<Donation>({ })
    const allDonations = cast<Donation[]>([
      { time: data.time1, amount: 1 },
      { time: data.time2, amount: 2 },
      { time: data.time3, amount: 3 }
    ])

    // user is currently donator and supporter, but no longer eligible for supporter
    const ranks = cast<UserRankWithRelations[]>([
      { id: 20, rank: { name: 'donator' } },
      { id: 21, rank: { name: 'supporter' } }
    ])
    mockDonationStore.unlinkUserFromDonation.calledWith(donationId).mockResolvedValue(userId)
    mockDonationStore.getDonationsByUserId.calledWith(userId).mockResolvedValue(allDonations)
    mockRankStore.getUserRanks.calledWith(expectArray<number>([userId])).mockResolvedValue([{ userId, ranks }])
    mockDonationHelpers.isEligibleForDonator
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(true)
    mockDonationHelpers.isEligibleForSupporter
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(false)
    mockDonationHelpers.isEligibleForMember
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(false)

    await donationService.unlinkUserFromDonation(donationId)

    // only one rank change should have been made:
    const providedRemoveArgs = single2(mockRankStore.removeUserRank.mock.calls)
    expect(providedRemoveArgs).toEqual(expectObject<RemoveUserRankArgs>({ rank: 'supporter' }))
    expect(mockRankStore.addUserRank).not.toHaveBeenCalled()
    expect(mockRankStore.updateRankExpiration).not.toHaveBeenCalled()
  })
})
