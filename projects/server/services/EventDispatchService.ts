import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItem } from '@rebel/server/models/chat'

// generic and centralised service for collecting and distributing data.
// this helps avoid complicated or even circular service dependencies.

type DataType = { chatItem: ChatItem & { streamerId: number } }

export type DataPair<T extends keyof DataType> = [T, DataType[T]]

type Listener<T extends keyof DataType = any> = (data: DataType[T]) => any | Promise<any>

export default class EventDispatchService extends ContextClass {
  private isReady: boolean
  private tempStore: DataPair<any>[]
  private listeners: Map<keyof DataType, Listener[]>

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
  public async addData<T extends keyof DataType> (type: T, data: DataType[T]) {
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
  public onData<T extends keyof DataType> (type: T, listener: Listener<T>) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)!.push(listener)
  }
}
