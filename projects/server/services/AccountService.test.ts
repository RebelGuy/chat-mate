import { Dependencies } from '@rebel/shared/context/context'
import AccountService from '@rebel/server/services/AccountService'
import AccountStore, { ConnectedChatUserIds } from '@rebel/server/stores/AccountStore'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { cast, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'

const streamerId = 5

let mockAccountStore: MockProxy<AccountStore>
let mockChannelStore: MockProxy<ChannelStore>
let accountService: AccountService

beforeEach(() => {
  mockAccountStore = mock()
  mockChannelStore = mock()

  accountService = new AccountService(new Dependencies({
    accountStore: mockAccountStore,
    channelStore: mockChannelStore
  }))
})

describe(nameof(AccountService, 'getStreamerPrimaryUserIds'), () => {
  test('Returns the unique primary user ids of all users who have participated in chat for this streamer', async () => {
    const channels = cast<UserChannel[]>([
      { aggregateUserId: 5, defaultUserId: 2 },
      { aggregateUserId: 5, defaultUserId: 3},
      { aggregateUserId: null, defaultUserId: 4 }
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(channels)

    const result = await accountService.getStreamerPrimaryUserIds(streamerId)

    expect(result).toEqual([5, 4])
  })
})

describe(nameof(AccountService, 'getPrimaryUserIdFromAnyUser'), () => {
  test(`Returns the correct primary user id by checking each user's connected users`, async () => {
    const userIds = [1, 11, 12]
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining(userIds)).mockResolvedValue(cast<ConnectedChatUserIds[]>([
      { queriedAnyUserId: 1, connectedChatUserIds: [1, 10] },
      { queriedAnyUserId: 11, connectedChatUserIds: [1, 2, 11] },
      { queriedAnyUserId: 12, connectedChatUserIds: [12] }
    ]))

    const result = await accountService.getPrimaryUserIdFromAnyUser(userIds)

    expect(result).toEqual([1, 1, 12])
  })
})
