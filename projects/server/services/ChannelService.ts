import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ChannelStore, { ChannelName } from '@rebel/server/stores/ChannelStore'
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

  /** Attempts to get the channel whose current name most closely matches the provided name. */
  public async getChannelByName (name: string): Promise<ChannelName | null> {
    if (name == null || name.length === 0) {
      return null
    }

    const channelNames = await this.channelStore.getCurrentChannelNames()

    name = name.toLowerCase()
    const matches = channelNames.filter(channel => channel.name.toLowerCase().includes(name))
    const [_, index] = min(matches.map(m => m.name.length))

    if (index === -1) {
      return null
    } else {
      return matches[index]
    }
  }

  public async getChannelById (id: number): Promise<ChannelName | null> {
    const channelNames = await this.channelStore.getCurrentChannelNames()
    return channelNames.find(channel => channel.id === id) ?? null
  }
}
