import { ChatUser, RegisteredUser, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore, { UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockAccountStore: MockProxy<AccountStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockStreamerStore: MockProxy<StreamerStore>
let streamerChannelService: StreamerChannelService

beforeEach(() => {
  mockAccountStore = mock()
  mockChannelStore = mock()
  mockStreamerStore = mock()

  streamerChannelService = new StreamerChannelService(new Dependencies({
    accountStore: mockAccountStore,
    channelStore: mockChannelStore,
    logService: mock(),
    streamerStore: mockStreamerStore
  }))
})

describe(nameof(StreamerChannelService, 'getAllTwitchChannelNames'), () => {
  test('Returns the Twitch channel names of all streamers', async () => {
    const chatUser1 = cast<ChatUser>({ id: 2 })
    const registeredUser1 = cast<RegisteredUser>({ id: 3, chatUserId: chatUser1.id })
    const streamer1 = cast<Streamer>({ id: 4, registeredUserId: registeredUser1.id })
    const twitchChannel = 5
    const channels = cast<UserOwnedChannels>({ twitchChannels: [twitchChannel] })
    const channelName = 'test'

    mockStreamerStore.getStreamers.calledWith().mockResolvedValue([streamer1])
    mockAccountStore.getRegisteredUserFromId.calledWith(registeredUser1.id).mockResolvedValue(registeredUser1)
    mockChannelStore.getUserOwnedChannels.calledWith(chatUser1.id).mockResolvedValue(channels)
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(twitchChannel).mockResolvedValue(channelName)

    const result = await streamerChannelService.getAllTwitchChannelNames()

    expect(result).toEqual([channelName])
  })

  test('Ignores streamers that do not have a linked chat user or Twitch channel', async () => {
    const chatUser1 = cast<ChatUser>({ id: 2 })
    const registeredUser1 = cast<RegisteredUser>({ id: 3, chatUserId: chatUser1.id })
    const registeredUser2 = cast<RegisteredUser>({ id: 4, chatUserId: null })
    const streamer1 = cast<Streamer>({ id: 4, registeredUserId: registeredUser1.id })
    const streamer2 = cast<Streamer>({ id: 5, registeredUserId: registeredUser2.id })
    const channels = cast<UserOwnedChannels>({ twitchChannels: [] })

    mockStreamerStore.getStreamers.calledWith().mockResolvedValue([streamer1, streamer2])
    mockAccountStore.getRegisteredUserFromId.calledWith(registeredUser1.id).mockResolvedValue(registeredUser1)
    mockAccountStore.getRegisteredUserFromId.calledWith(registeredUser2.id).mockResolvedValue(registeredUser2)
    mockChannelStore.getUserOwnedChannels.calledWith(chatUser1.id).mockResolvedValue(channels)

    const result = await streamerChannelService.getAllTwitchChannelNames()

    expect(result).toEqual([])
  })
})

describe(nameof(StreamerChannelService, 'getTwitchChannelName'), () => {
  test(`Returns the streamer's linked Twitch channel`, async () => {
    const streamerId = 50
    const chatUser = cast<ChatUser>({ id: 2 })
    const registeredUser = cast<RegisteredUser>({ id: 3, chatUserId: chatUser.id })
    const streamer = cast<Streamer>({ id: streamerId, registeredUserId: registeredUser.id })
    const twitchChannel = 5
    const channels = cast<UserOwnedChannels>({ twitchChannels: [twitchChannel] })
    const channelName = 'test'

    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(streamer)
    mockAccountStore.getRegisteredUserFromId.calledWith(registeredUser.id).mockResolvedValue(registeredUser)
    mockChannelStore.getUserOwnedChannels.calledWith(chatUser.id).mockResolvedValue(channels)
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(twitchChannel).mockResolvedValue(channelName)

    const result = await streamerChannelService.getTwitchChannelName(streamerId)

    expect(result).toEqual(channelName)

  })

  test('Returns the first channel if a streamer has multiple linked Twitch channels', async () => {
    const streamerId = 50
    const chatUser = cast<ChatUser>({ id: 2 })
    const registeredUser = cast<RegisteredUser>({ id: 3, chatUserId: chatUser.id })
    const streamer = cast<Streamer>({ id: streamerId, registeredUserId: registeredUser.id })
    const twitchChannel1 = 5
    const twitchChannel2 = 6
    const channels = cast<UserOwnedChannels>({ twitchChannels: [twitchChannel1, twitchChannel2] })
    const channelName = 'test'

    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(streamer)
    mockAccountStore.getRegisteredUserFromId.calledWith(registeredUser.id).mockResolvedValue(registeredUser)
    mockChannelStore.getUserOwnedChannels.calledWith(chatUser.id).mockResolvedValue(channels)
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(twitchChannel1).mockResolvedValue(channelName)

    const result = await streamerChannelService.getTwitchChannelName(streamerId)

    expect(result).toEqual(channelName)
  })

  test('Returns null if the streamer does not have a linked Twitch channel', async () => {
    const streamerId = 50
    const chatUser = cast<ChatUser>({ id: 2 })
    const registeredUser = cast<RegisteredUser>({ id: 3, chatUserId: chatUser.id })
    const streamer = cast<Streamer>({ id: streamerId, registeredUserId: registeredUser.id })
    const channels = cast<UserOwnedChannels>({ twitchChannels: [] })

    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(streamer)
    mockAccountStore.getRegisteredUserFromId.calledWith(registeredUser.id).mockResolvedValue(registeredUser)
    mockChannelStore.getUserOwnedChannels.calledWith(chatUser.id).mockResolvedValue(channels)

    const result = await streamerChannelService.getTwitchChannelName(streamerId)

    expect(result).toBeNull()
  })
})
