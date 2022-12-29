import { LinkAttempt, LinkToken, YoutubeChannel } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import CommandService, { CommandData } from '@rebel/server/services/command/CommandService'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import LinkDataService, { LinkHistory } from '@rebel/server/services/LinkDataService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { addTime } from '@rebel/server/util/datetime'
import { NotFoundError, UserAlreadyLinkedToAggregateUserError } from '@rebel/server/util/error'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockAccountStore: MockProxy<AccountStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockCommandService: MockProxy<CommandService>
let mockLinkCommand: MockProxy<LinkCommand>
let mockLinkStore: MockProxy<LinkStore>
let linkDataService: LinkDataService

beforeEach(() => {
  mockAccountStore = mock()
  mockChannelStore = mock()
  mockCommandService = mock()
  mockLinkCommand = mock<LinkCommand>({ normalisedNames: ['LINK'] })
  mockLinkStore = mock()
  linkDataService = mock()

  linkDataService = new LinkDataService(new Dependencies({
    accountStore: mockAccountStore,
    channelStore: mockChannelStore,
    commandService: mockCommandService,
    linkCommand: mockLinkCommand,
    linkStore: mockLinkStore
  }))
})

describe(nameof(LinkDataService, 'getOrCreateLinkToken'), () => {
  test('Calls the linkStore method', async () => {
    const aggregateUserId = 2
    const defaultUserId = 5
    const externalChannelId = 'external'
    mockChannelStore.getChannelFromExternalId.calledWith(externalChannelId).mockResolvedValue(cast<YoutubeChannel>({ userId: defaultUserId }))
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue([defaultUserId])
    const expectedToken = cast<LinkToken>({})
    mockLinkStore.getOrCreateLinkToken.calledWith(aggregateUserId, defaultUserId).mockResolvedValue(expectedToken)

    const result = await linkDataService.getOrCreateLinkToken(aggregateUserId, externalChannelId)

    expect(result).toBe(expectedToken)
  })

  test(`Throws ${NotFoundError.name} when the channel could not be found`, async () => {
    const aggregateUserId = 2
    const externalChannelId = 'external'
    mockChannelStore.getChannelFromExternalId.calledWith(externalChannelId).mockResolvedValue(null)

    await expect(() => linkDataService.getOrCreateLinkToken(aggregateUserId, externalChannelId)).rejects.toThrowError(NotFoundError)
  })

  test(`Throws ${UserAlreadyLinkedToAggregateUserError.name} when the channel could not be found`, async () => {
    const aggregateUserId = 2
    const defaultUserId = 5
    const externalChannelId = 'external'
    mockChannelStore.getChannelFromExternalId.calledWith(externalChannelId).mockResolvedValue(cast<YoutubeChannel>({ userId: defaultUserId }))
    mockAccountStore.getConnectedChatUserIds.calledWith(defaultUserId).mockResolvedValue([aggregateUserId, defaultUserId])

    await expect(() => linkDataService.getOrCreateLinkToken(aggregateUserId, externalChannelId)).rejects.toThrowError(UserAlreadyLinkedToAggregateUserError)
  })
})

describe(nameof(LinkDataService, 'getLinkHistory'), () => {
  test('Returns links from queued/running commands as well as historic link tokens', async () => {
    const aggregateUserId = 1234
    const token1 = 'token1'
    const token2 = 'token2'
    const token3 = 'token3'
    const token4 = 'token4'
    const token5 = 'token5'
    const defaultUserId1 = 5
    const defaultUserId2 = 6
    const defaultUserId3 = 7
    const defaultUserId4 = 8
    const defaultUserId5 = 9
    const endTime1 = new Date()
    const endTime2 = addTime(endTime1, 'seconds', 1)

    mockCommandService.getQueuedCommands.calledWith().mockReturnValue([
      cast<CommandData>({ normalisedName: 'LINK', arguments: [token1], userId: defaultUserId1 }),
      cast<CommandData>({ normalisedName: 'OTHER', arguments: [], userId: 1 }),
      cast<CommandData>({ normalisedName: 'LINK', arguments: [token2], userId: defaultUserId2 })
    ])
    mockCommandService.getRunningCommand.calledWith().mockReturnValue(cast<CommandData>({ normalisedName: 'LINK', arguments: [token3], userId: defaultUserId3 }))
    mockLinkStore.getAllLinkTokens.calledWith(aggregateUserId).mockResolvedValue([
      cast<LinkToken & { linkAttempt: LinkAttempt | null }>({ token: token4, defaultChatUserId: defaultUserId4, linkAttempt: { errorMessage: 'error', endTime: endTime1 }}),
      cast<LinkToken & { linkAttempt: LinkAttempt | null }>({ token: 'blah', defaultChatUserId: 123, linkAttempt: null}),
      cast<LinkToken & { linkAttempt: LinkAttempt | null }>({ token: token5, defaultChatUserId: defaultUserId5, linkAttempt: { errorMessage: null, endTime: endTime2 }}),
    ])

    const result = await linkDataService.getLinkHistory(aggregateUserId)

    expect(result.length).toBe(5)
    expect(result).toEqual(expectObject<LinkHistory>([
      { type: 'pending', defaultUserId: defaultUserId1, maybeToken: token1 },
      { type: 'pending', defaultUserId: defaultUserId2, maybeToken: token2 },
      { type: 'running', defaultUserId: defaultUserId3, maybeToken: token3 },
      { type: 'fail', defaultUserId: defaultUserId4, token: token4, completionTime: endTime1 },
      { type: 'success', defaultUserId: defaultUserId5, token: token5, completionTime: endTime2 }
    ]))
  })
})
