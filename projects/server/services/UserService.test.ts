import { Dependencies } from '@rebel/shared/context/context'
import UserService from '@rebel/server/services/UserService'
import LinkStore from '@rebel/server/stores/LinkStore'
import { nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockLinkStore: MockProxy<LinkStore>
let userService: UserService

beforeEach(() => {
  mockLinkStore = mock()

  userService = new UserService(new Dependencies({
    linkStore: mockLinkStore
  }))
})

describe(nameof(UserService, 'isUserBusy'), () => {
  test('Returns true if user is currently being linked', async () => {
    const userId = 5
    mockLinkStore.isLinkInProgress.calledWith(userId).mockResolvedValue(true)

    const result = await userService.isUserBusy(userId)

    expect(result).toBe(true)
  })

  test('Returns false if user is not currently being linked', async () => {
    const userId = 5
    mockLinkStore.isLinkInProgress.calledWith(userId).mockResolvedValue(false)

    const result = await userService.isUserBusy(userId)

    expect(result).toBe(false)
  })
})
