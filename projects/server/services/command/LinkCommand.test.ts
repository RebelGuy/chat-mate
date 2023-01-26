import { LinkToken } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import LinkService from '@rebel/server/services/LinkService'
import LinkStore from '@rebel/server/stores/LinkStore'
import { single } from '@rebel/server/util/arrays'
import { InvalidCommandArgumentsError } from '@rebel/server/util/error'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockLinkService: MockProxy<LinkService>
let mockLinkStore: MockProxy<LinkStore>
let linkCommand: LinkCommand

beforeEach(() => {
  mockLinkService = mock()
  mockLinkStore = mock()

  linkCommand = new LinkCommand(new Dependencies({
    linkService: mockLinkService,
    linkStore: mockLinkStore
  }))
})

describe(nameof(LinkCommand, 'executeCommand'), () => {
  test(`Throws ${InvalidCommandArgumentsError.name} if no argument or multiple arguments have been provided`, async () => {
    const args1: string[] = []
    const args2 = ['test1', 'test2']

    await expect(() => linkCommand.executeCommand(1, args1)).rejects.toThrowError(InvalidCommandArgumentsError)
    await expect(() => linkCommand.executeCommand(1, args2)).rejects.toThrowError(InvalidCommandArgumentsError)
  })

  test('Links the default user to the aggregate user', async () => {
    const defaultUserId = 5
    const aggregateUserId = 12
    const linkToken = 'abc'
    mockLinkStore.validateLinkToken.calledWith(defaultUserId, linkToken).mockResolvedValue(cast<LinkToken>({ aggregateChatUserId: aggregateUserId, token: linkToken }))

    await linkCommand.executeCommand(defaultUserId, [linkToken])

    expect(single(mockLinkService.linkUser.mock.calls)).toEqual([defaultUserId, aggregateUserId, linkToken])
  })

  test(`Throws ${InvalidCommandArgumentsError.name} when the token was not found`, async () => {
    const defaultUserId = 5
    const linkToken = 'abc'
    mockLinkStore.validateLinkToken.calledWith(defaultUserId, linkToken).mockResolvedValue(null)

    await expect(() => linkCommand.executeCommand(defaultUserId, [linkToken])).rejects.toThrowError(InvalidCommandArgumentsError)
  })
})
