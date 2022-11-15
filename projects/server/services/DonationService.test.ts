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
import EmojiService from '@rebel/server/services/EmojiService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import { PartialChatMessage } from '@rebel/server/models/chat'

const streamerId = 3

let mockDonationStore: MockProxy<DonationStore>
let mockDonationHelpers: MockProxy<DonationHelpers>
let mockRankStore: MockProxy<RankStore>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let mockEmojiService: MockProxy<EmojiService>
let mockStreamlabsProxyService: MockProxy<StreamlabsProxyService>
let donationService: DonationService

beforeEach(() => {
  mockDonationStore = mock()
  mockDonationHelpers = mock()
  mockRankStore = mock()
  mockDateTimeHelpers = mock()
  mockEmojiService = mock()
  mockStreamlabsProxyService = mock()

  donationService = new DonationService(new Dependencies({
    donationStore: mockDonationStore,
    donationHelpers: mockDonationHelpers,
    rankStore: mockRankStore,
    dateTimeHelpers: mockDateTimeHelpers,
    emojiService: mockEmojiService,
    streamlabsProxyService: mockStreamlabsProxyService
  }))
})

describe(nameof(DonationService, 'addDonation'), () => {
  test('Adds donation without message', async () => {
    const donation: StreamlabsDonation = {
      amount: 1,
      createdAt: data.time1.getTime(),
      currency: 'USD',
      donationId: 100,
      formattedAmount: '1 USD',
      message: null,
      name: 'Test name',
      streamlabsUserId: null
    }

    await donationService.addDonation(donation, streamerId)

    expect(mockEmojiService.applyCustomEmojisToDonation.mock.calls.length).toBe(0)

    const addedData = single(single(mockDonationStore.addDonation.mock.calls))
    expect(addedData.messageParts.length).toBe(0)
  })

  test('Adds donation with message and custom emojis', async () => {
    const message = 'testMessage'
    const donation: StreamlabsDonation = {
      amount: 1,
      createdAt: data.time1.getTime(),
      currency: 'USD',
      donationId: 100,
      formattedAmount: '1 USD',
      message: message,
      name: 'Test name',
      streamlabsUserId: null
    }
    const parts = cast<PartialChatMessage[]>([{ type: 'text' }, { type: 'customEmoji' }])
    mockEmojiService.applyCustomEmojisToDonation.calledWith(message, streamerId).mockResolvedValue(parts)

    await donationService.addDonation(donation, streamerId)

    const addedData = single(single(mockDonationStore.addDonation.mock.calls))
    expect(addedData.messageParts).toBe(parts)
  })
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
    mockDateTimeHelpers.now.calledWith().mockReturnValue(time)
    mockDonationStore.getDonationsByUserId.calledWith(streamerId, userId).mockResolvedValue(allDonations)
    mockRankStore.getUserRanks.calledWith(expectArray<number>([userId]), streamerId).mockResolvedValue([{ userId, ranks }])
    mockDonationHelpers.isEligibleForDonator
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(true)
    mockDonationHelpers.isEligibleForSupporter
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(true)
    mockDonationHelpers.isEligibleForMember
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(false)

    await donationService.linkUserToDonation(donationId, userId, streamerId)

    expect(mockDonationStore.linkUserToDonation).toBeCalledWith(donationId, userId, time)

    // only two rank changes should have been made:
    const providedUpdateArgs = single(mockRankStore.updateRankExpiration.mock.calls)
    expect(providedUpdateArgs).toEqual<typeof providedUpdateArgs>([ranks[0].id, expect.anything()])
    const providedCreateArgs = single2(mockRankStore.addUserRank.mock.calls)
    expect(providedCreateArgs).toEqual(expectObject<AddUserRankArgs>({ rank: 'supporter', time: time }))
    expect(mockRankStore.removeUserRank).not.toHaveBeenCalled()
  })
})

describe(nameof(DonationService, 'setStreamlabsSocketToken'), () => {
  test(`Executes no further actions if the token hasn't changed`, async () => {
    const token = 'test'
    mockDonationStore.setStreamlabsSocketToken.calledWith(streamerId, token).mockResolvedValue(false)

    const result = await donationService.setStreamlabsSocketToken(streamerId, token)

    expect(result).toBe(false)
    expect(mockStreamlabsProxyService.listenToStreamerDonations.mock.calls.length).toBe(0)
    expect(mockStreamlabsProxyService.stopListeningToStreamerDonations.mock.calls.length).toBe(0)
  })

  test(`Starts listening to donations if the token is defined and has changed`, async () => {
    const token = 'test'
    mockDonationStore.setStreamlabsSocketToken.calledWith(streamerId, token).mockResolvedValue(true)

    const result = await donationService.setStreamlabsSocketToken(streamerId, token)

    expect(result).toBe(true)
    expect(single(mockStreamlabsProxyService.listenToStreamerDonations.mock.calls)).toEqual([streamerId, token])
    expect(mockStreamlabsProxyService.stopListeningToStreamerDonations.mock.calls.length).toBe(0)
  })

  test(`Stops listening to donations if the token is not defined and has changed`, async () => {
    const token = null
    mockDonationStore.setStreamlabsSocketToken.calledWith(streamerId, token).mockResolvedValue(true)

    const result = await donationService.setStreamlabsSocketToken(streamerId, token)

    expect(result).toBe(true)
    expect(mockStreamlabsProxyService.listenToStreamerDonations.mock.calls.length).toBe(0)
    expect(single(mockStreamlabsProxyService.stopListeningToStreamerDonations.mock.calls)).toEqual([streamerId])
  })
})

describe(nameof(DonationService, 'unlinkUserFromDonation'), () => {
  test('Unlinks the user from the donation, and calls dependencies to remove the Supporter rank', async () => {
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
    mockDonationStore.getDonationsByUserId.calledWith(streamerId, userId).mockResolvedValue(allDonations)
    mockRankStore.getUserRanks.calledWith(expectArray<number>([userId]), streamerId).mockResolvedValue([{ userId, ranks }])
    mockDonationHelpers.isEligibleForDonator
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(true)
    mockDonationHelpers.isEligibleForSupporter
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(false)
    mockDonationHelpers.isEligibleForMember
      .calledWith(expectArray<DonationAmount>([[data.time1, 1], [data.time2, 2], [data.time3, 3]]), any())
      .mockReturnValue(false)

    await donationService.unlinkUserFromDonation(donationId, streamerId)

    // only one rank change should have been made:
    const providedRemoveArgs = single2(mockRankStore.removeUserRank.mock.calls)
    expect(providedRemoveArgs).toEqual(expectObject<RemoveUserRankArgs>({ rank: 'supporter' }))
    expect(mockRankStore.addUserRank).not.toHaveBeenCalled()
    expect(mockRankStore.updateRankExpiration).not.toHaveBeenCalled()
  })
})
