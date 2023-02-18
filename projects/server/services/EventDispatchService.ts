import ContextClass from '@rebel/shared/context/ContextClass'
import { ChatItem } from '@rebel/server/models/chat'
import { UserChannel } from '@rebel/server/stores/ChannelStore'

// generic and centralised service for collecting and distributing data.
// this helps avoid complicated or even circular service dependencies.

export type EventData = {
  chatItem: ChatItem & { streamerId: number },
  addPrimaryChannel: { streamerId: number, userChannel: UserChannel },
  removePrimaryChannel: { streamerId: number, userChannel: UserChannel }
}

export type DataPair<T extends keyof EventData> = [T, EventData[T]]

type Listener<T extends keyof EventData = any> = (data: EventData[T]) => any | Promise<any>

export default class EventDispatchService extends ContextClass {
  private isReady: boolean
  private tempStore: DataPair<any>[]
  private listeners: Map<keyof EventData, Listener[]>

  constructor () {
    super()

    this.isReady = false
    this.tempStore = []
    this.listeners = new Map()
  }

  // don't distribute data until initial listeners have subscribed.
  // it is assumed that all subscriptions are completed in the `initialise()` cycle.
  public override async onReady () {
    this.isReady = true

    // replay stored data one-by-one
    for (const pair of this.tempStore) {
      await this.addData(pair[0], pair[1])
    }
    this.tempStore = null!
  }

  /** Notifies subscribers of the new data. */
  public async addData<T extends keyof EventData> (type: T, data: EventData[T]) {
    if (!this.isReady) {
      const pair: DataPair<T> = [type, data]
      this.tempStore.push(pair)
      return
    }

    if (this.listeners.has(type)) {
      await Promise.all(this.listeners.get(type)!.map(listener => listener(data)))
    }
  }

  /** Starts listening to data. The listener is responsible for catching all errors. */
  public onData<T extends keyof EventData> (type: T, listener: Listener<T>) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)!.push(listener)
  }
}
