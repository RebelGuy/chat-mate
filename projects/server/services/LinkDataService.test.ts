import { LinkAttempt, LinkToken, YoutubeChannel } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import AccountService from '@rebel/server/services/AccountService'
import CommandService, { CommandData } from '@rebel/server/services/command/CommandService'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import LinkDataService, { LinkHistory } from '@rebel/server/services/LinkDataService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { addTime } from '@rebel/shared/util/datetime'
import { NotFoundError, UserAlreadyLinkedToAggregateUserError } from '@rebel/shared/util/error'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockAccountStore: MockProxy<AccountStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockCommandService: MockProxy<CommandService>
let mockLinkCommand: MockProxy<LinkCommand>
let mockLinkStore: MockProxy<LinkStore>
let mockAccountService: MockProxy<AccountService>
let linkDataService: LinkDataService

beforeEach(() => {
  mockAccountStore = mock()
  mockChannelStore = mock()
  mockCommandService = mock()
  mockLinkCommand = mock<LinkCommand>({ normalisedNames: ['LINK'] })
  mockLinkStore = mock()
  mockAccountService = mock()

  linkDataService = new LinkDataService(new Dependencies({
    accountStore: mockAccountStore,
    channelStore: mockChannelStore,
    commandService: mockCommandService,
    linkCommand: mockLinkCommand,
    linkStore: mockLinkStore,
    accountService: mockAccountService
  }))
})

describe(nameof(LinkDataService, 'getOrCreateLinkToken'), () => {
  test('Calls the linkStore method', async () => {
    const aggregateUserId = 2
    const defaultUserId = 5
    const externalChannelId = 'external'
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(externalChannelId).mockResolvedValue(cast<YoutubeChannel>({ userId: defaultUserId }))
    mockAccountService.getPrimaryUserIdFromAnyUser.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([defaultUserId])
    const expectedToken = cast<LinkToken>({})
    mockLinkStore.getOrCreateLinkToken.calledWith(aggregateUserId, defaultUserId).mockResolvedValue(expectedToken)

    const result = await linkDataService.getOrCreateLinkToken(aggregateUserId, externalChannelId)

    expect(result).toBe(expectedToken)
  })

  test(`Throws ${NotFoundError.name} when the channel could not be found`, async () => {
    const aggregateUserId = 2
    const externalChannelId = 'external'
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(externalChannelId).mockResolvedValue(null)

    await expect(() => linkDataService.getOrCreateLinkToken(aggregateUserId, externalChannelId)).rejects.toThrowError(NotFoundError)
  })

  test(`Throws ${UserAlreadyLinkedToAggregateUserError.name} when the channel could not be found`, async () => {
    const aggregateUserId = 2
    const defaultUserId = 5
    const externalChannelId = 'external'
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(externalChannelId).mockResolvedValue(cast<YoutubeChannel>({ userId: defaultUserId }))
    mockAccountService.getPrimaryUserIdFromAnyUser.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([aggregateUserId])

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
    const token6 = 'token6'
    const defaultUserId1 = 5
    const defaultUserId2 = 6
    const defaultUserId3 = 7
    const defaultUserId4 = 8
    const defaultUserId5 = 9
    const defaultUserId6 = 10
    const defaultUserId7 = 11
    const defaultUserId8 = 12
    const endTime1 = new Date()
    const endTime2 = addTime(endTime1, 'seconds', 1)
    const endTime3 = addTime(endTime2, 'seconds', 1)

    mockCommandService.getQueuedCommands.calledWith().mockReturnValue([
      cast<CommandData>({ normalisedName: 'LINK', arguments: [token1], defaultUserId: defaultUserId1 }),
      cast<CommandData>({ normalisedName: 'OTHER', arguments: [], defaultUserId: 1 }),
      cast<CommandData>({ normalisedName: 'LINK', arguments: [token2], defaultUserId: defaultUserId2 })
    ])
    mockCommandService.getRunningCommand.calledWith().mockReturnValue(cast<CommandData>({ normalisedName: 'LINK', arguments: [token3], defaultUserId: defaultUserId3 }))
    mockLinkStore.getAllStandaloneLinkAttempts.calledWith(aggregateUserId).mockResolvedValue([
      cast<LinkAttempt>({ defaultChatUserId: defaultUserId4, type: 'unlink', endTime: null }),
      cast<LinkAttempt>({ defaultChatUserId: defaultUserId5, type: 'link', endTime: endTime1 })
    ])
    mockLinkStore.getAllLinkTokens.calledWith(aggregateUserId).mockResolvedValue([
      cast<LinkToken & { linkAttempt: LinkAttempt | null }>({ token: token4, defaultChatUserId: defaultUserId6, linkAttempt: { errorMessage: 'error', endTime: endTime2 }}),
      cast<LinkToken & { linkAttempt: LinkAttempt | null }>({ token: token5, defaultChatUserId: defaultUserId7, linkAttempt: null}),
      cast<LinkToken & { linkAttempt: LinkAttempt | null }>({ token: token6, defaultChatUserId: defaultUserId8, linkAttempt: { errorMessage: null, endTime: endTime3 }}),
    ])

    const result = await linkDataService.getLinkHistory(aggregateUserId)

    expect(result.length).toBe(8)
    expect(result).toEqual(expectObject<LinkHistory>([
      { type: 'pending', defaultUserId: defaultUserId1, isLink: true, maybeToken: token1 },
      { type: 'pending', defaultUserId: defaultUserId2, isLink: true, maybeToken: token2 },
      { type: 'running', defaultUserId: defaultUserId3, isLink: true, maybeToken: token3 },
      { type: 'running', defaultUserId: defaultUserId4, isLink: false, maybeToken: null },
      { type: 'success', defaultUserId: defaultUserId5, isLink: true, token: null },
      { type: 'fail', defaultUserId: defaultUserId6, isLink: true, token: token4, completionTime: endTime2 },
      { type: 'waiting', defaultUserId: defaultUserId7, isLink: true, token: token5 },
      { type: 'success', defaultUserId: defaultUserId8, isLink: true, token: token6, completionTime: endTime3 }
    ]))
  })
})
