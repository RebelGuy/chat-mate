import { Dependencies } from '@rebel/server/context/context'
import ChannelService from '@rebel/server/services/ChannelService'
import ChannelStore, { ChannelName } from '@rebel/server/stores/ChannelStore'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockChannelStore: MockProxy<ChannelStore>
let channelService: ChannelService

beforeEach(() => {
  mockChannelStore = mock<ChannelStore>()

  channelService = new ChannelService(new Dependencies({
    channelStore: mockChannelStore
  }))
})

describe(nameof(ChannelService, 'getChannelByName'), () => {
  test('returns null if there is no match', async () => {
    mockChannelStore.getCurrentChannelNames.mockResolvedValue([{ name: 'Mr Cool Guy', youtubeId: 'id1' }])

    const result = await channelService.getChannelByName('rebel_guy')

    expect(result).toBeNull()
  })

  test('returns best match', async () => {
    const names: ChannelName[] = [
      { name: 'Mr Cool Guy', youtubeId: 'id1' },
      { name: 'Rebel', youtubeId: 'id2' },
      { name: 'Rebel_Guy', youtubeId: 'id3' },
      { name: 'Rebel_Guy2', youtubeId: 'id3' }
    ]
    mockChannelStore.getCurrentChannelNames.mockResolvedValue(names)

    const result = await channelService.getChannelByName('rebel_guy')

    expect(result).toEqual(names[2])
  })
})
