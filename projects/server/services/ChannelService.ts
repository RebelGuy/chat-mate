import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ChannelStore, { ChannelName } from '@rebel/server/stores/ChannelStore'
import { sortBy } from '@rebel/server/util/arrays'
import { min } from '@rebel/server/util/math'

type Deps = Dependencies<{
  channelStore: ChannelStore
}>

export default class ChannelService extends ContextClass {
  private readonly channelStore: ChannelStore

  public constructor (deps: Deps) {
    super()
    this.channelStore = deps.resolve('channelStore')
  }

  /** Returns channels matching the given name, sorted in ascending order of channel name length (i.e. best sequential match is first). */
  public async getChannelByName (name: string): Promise<ChannelName[]> {
    if (name == null || name.length === 0) {
      return []
    }

    const channelNames = await this.channelStore.getCurrentChannelNames()

    name = name.toLowerCase()
    const matches = channelNames.filter(channel => channel.name.toLowerCase().includes(name))
    return sortBy(matches, m => m.name.length, 'asc')
  }

  public async getChannelById (id: number): Promise<ChannelName | null> {
    const channelNames = await this.channelStore.getCurrentChannelNames()
    return channelNames.find(channel => channel.id === id) ?? null
  }
}
