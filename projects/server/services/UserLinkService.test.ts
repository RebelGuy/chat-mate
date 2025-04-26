import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import AuthService from '@rebel/server/services/AuthService'
import ChannelService from '@rebel/server/services/ChannelService'
import LinkService from '@rebel/server/services/LinkService'
import { TwitchChannelWithLatestInfo, YoutubeChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import { single } from '@rebel/shared/util/arrays'
import UserLinkService from '@rebel/server/services/UserLinkService'

let mockAuthService: MockProxy<AuthService>
let mockChannelService: MockProxy<ChannelService>
let mockLinkService: MockProxy<LinkService>
let userLinkService: UserLinkService

beforeEach(() => {
  mockAuthService = mock()
  mockChannelService = mock()
  mockLinkService = mock()

  userLinkService = new UserLinkService(new Dependencies({
    authService: mockAuthService,
    channelService: mockChannelService,
    linkService: mockLinkService
  }))
})

describe(nameof(UserLinkService, 'linkYoutubeAccountToUser'), () => {
  test('Authenticates the given code and links the owned Youtube channel to the specified user', async () => {
    const code = 'code'
    const aggregateUserId = 12
    const channelInfo = { id: 'id', name: 'name', image: 'image' }
    const channelUserId = 51
    mockAuthService.authoriseYoutubeUserAndGetChannel.calledWith(code).mockResolvedValue(channelInfo)
    mockChannelService.getOrCreateYoutubeChannel.calledWith(channelInfo.id, channelInfo.name, channelInfo.image, false).mockResolvedValue(cast<YoutubeChannelWithLatestInfo>({ userId: channelUserId }))

    await userLinkService.linkYoutubeAccountToUser(code, aggregateUserId)

    const args = single(mockLinkService.linkUser.mock.calls)
    expect(args).toEqual<typeof args>([channelUserId, aggregateUserId, null])
  })
})

describe(nameof(UserLinkService, 'linkTwitchAccountToUser'), () => {
  test('Authenticates the given code and links the owned Youtube channel to the specified user', async () => {
    const code = 'code'
    const aggregateUserId = 12
    const channelInfo = { id: 'id', name: 'name', displayName: 'displayName' }
    const channelUserId = 51
    mockAuthService.authoriseTwitchUserAndGetChannel.calledWith(code).mockResolvedValue(channelInfo)
    mockChannelService.getOrCreateTwitchChannel.calledWith(channelInfo.id, channelInfo.name, channelInfo.displayName, '', '').mockResolvedValue(cast<TwitchChannelWithLatestInfo>({ userId: channelUserId }))

    await userLinkService.linkTwitchAccountToUser(code, aggregateUserId)

    const args = single(mockLinkService.linkUser.mock.calls)
    expect(args).toEqual<typeof args>([channelUserId, aggregateUserId, null])
  })
})
