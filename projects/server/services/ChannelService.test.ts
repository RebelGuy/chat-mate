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

describe(nameof(ChannelService, 'getChannelById'), () => {
  test('returns null if channel with id does not exist', async () => {
    mockChannelStore.getCurrentChannelNames.mockResolvedValue([{ id: 1, name: 'Mr Cool Guy', youtubeId: 'id1' }])

    const result = await channelService.getChannelById(2)

    expect(result).toBeNull()
  })
  
  test('returns correct channel with id', async () => {
    const names: ChannelName[] = [
      { id: 1, name: 'Mr Cool Guy', youtubeId: 'id1' },
      { id: 2, name: 'Rebel', youtubeId: 'id2' },
      { id: 3, name: 'Rebel_Guy', youtubeId: 'id3' }
    ]
    mockChannelStore.getCurrentChannelNames.mockResolvedValue(names)

    const result = await channelService.getChannelById(2)

    expect(result).toEqual(names[1])
  })
})

describe(nameof(ChannelService, 'getChannelByName'), () => {
  test('returns null if there is no match', async () => {
    mockChannelStore.getCurrentChannelNames.mockResolvedValue([{ id: 1, name: 'Mr Cool Guy', youtubeId: 'id1' }])

    const result = await channelService.getChannelByName('rebel_guy')

    expect(result).toEqual([])
  })

  test('returns best match', async () => {
    const names: ChannelName[] = [
      { id: 1, name: 'Mr Cool Guy', youtubeId: 'id1' },
      { id: 2, name: 'Rebel_Guy', youtubeId: 'id3' },
      { id: 3, name: 'Rebel', youtubeId: 'id2' },
      { id: 4, name: 'Rebel_Guy2', youtubeId: 'id3' }
    ]
    mockChannelStore.getCurrentChannelNames.mockResolvedValue(names)

    const result = await channelService.getChannelByName('rebel')

    expect(result).toEqual([names[2], names[1], names[3]])
  })
})
