import { Dependencies } from '@rebel/shared/context/context'
import AccountService from '@rebel/server/services/AccountService'
import AccountStore, { ConnectedChatUserIds } from '@rebel/server/stores/AccountStore'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { cast, expectArray, expectInvocation, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import { RegisteredUser } from '@prisma/client'
import { single2 } from '@rebel/shared/util/arrays'
import { NotLoggedInError } from '@rebel/shared/util/error'

const streamerId = 5

let mockAccountStore: MockProxy<AccountStore>
let mockChannelStore: MockProxy<ChannelStore>
let accountService: AccountService

beforeEach(() => {
  mockAccountStore = mock()
  mockChannelStore = mock()

  accountService = new AccountService(new Dependencies({
    accountStore: mockAccountStore,
    channelStore: mockChannelStore,
    logService: mock()
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

describe(nameof(AccountService, 'resetPassword'), () => {
  test(`Clears the user's tokens, changes the password, and returns the new token`, async () => {
    const registeredUserId = 51
    const oldPassword = 'oldPassword'
    const newPassword = 'newPassword'
    const username = 'testUser'
    const newLoginToken = 'newLoginToken'
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray([registeredUserId])).mockResolvedValue(cast<RegisteredUser[]>([{ username }]))
    mockAccountStore.checkPassword.calledWith(username, oldPassword).mockResolvedValue(true)
    mockAccountStore.createLoginToken.calledWith(username).mockResolvedValue(newLoginToken)

    const result = await accountService.resetPassword(registeredUserId, oldPassword, newPassword)

    expectInvocation(mockAccountStore.clearLoginTokens, [registeredUserId])
    expectInvocation(mockAccountStore.setPassword, [username, newPassword])
    expect(result).toBe(newLoginToken)
  })

  test(`Throws ${NotLoggedInError.name} if the current password is incorrect`, async () => {
    const registeredUserId = 51
    const username = 'testUser'
    const oldPassword = 'oldPassword'
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray([registeredUserId])).mockResolvedValue(cast<RegisteredUser[]>([{ username }]))
    mockAccountStore.checkPassword.calledWith(username, oldPassword).mockResolvedValue(false)

    await expect(() => accountService.resetPassword(registeredUserId, oldPassword, '')).rejects.toThrowError(NotLoggedInError)

    expect(mockAccountStore.setPassword.mock.calls.length).toBe(0)
  })
})
