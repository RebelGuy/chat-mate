import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { ChatItem } from '@rebel/server/models/chat'
import { UserChannel } from '@rebel/server/stores/ChannelStore'
import { ChatMessage } from '@prisma/client'
import { Level } from '@rebel/server/services/ExperienceService'
import { DonationWithUser } from '@rebel/server/services/DonationService'
import { ParsedRankEvent } from '@rebel/server/stores/RankStore'
import { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'

// generic and centralised service for collecting and distributing data.
// this helps avoid complicated or even circular service dependencies.

// INTERNAL EVENTS

/** Fires when a chat item is to be added to the database. */
export const EVENT_CHAT_ITEM = Symbol('EVENT_CHAT_ITEM')
export const EVENT_CHAT_ITEM_REMOVED = Symbol('EVENT_CHAT_ITEM_REMOVED')
export const EVENT_ADD_PRIMARY_CHANNEL = Symbol('EVENT_ADD_PRIMARY_CHANNEL')
export const EVENT_REMOVE_PRIMARY_CHANNEL = Symbol('EVENT_REMOVE_PRIMARY_CHANNEL')
export const EVENT_STREAMLABS_DONATION = Symbol('EVENT_STREAMLABS_DONATION')

// PUBLIC EVENTS

/** Fires when a chat item was added to the database. */
export const EVENT_PUBLIC_CHAT_ITEM = Symbol('EVENT_PUBLIC_CHAT_ITEM')

/** Fires when a user levels up. */
export const EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP = Symbol('EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP')

/** Fires when a new Twitch user follows the streamer's channel. */
export const EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER = Symbol('EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER')

/** Fires when a ChatMate donation event occurs. */
export const EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION = Symbol('EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION')

/** Fires when a new viewer joins a streamer's chat. */
export const EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER = Symbol('EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER')

/** Fires when a message in a streamer's chat has been deleted. */
export const EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED = Symbol('EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED')

/** Fires when a message in a streamer's chat has been deleted. */
export const EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE = Symbol('EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE')

export type EventData = {
  [EVENT_CHAT_ITEM]: ChatItem & {
    streamerId: number
  }

  [EVENT_CHAT_ITEM_REMOVED]: {
    externalMessageId: string
  }

  [EVENT_ADD_PRIMARY_CHANNEL]: {
    streamerId: number
    userChannel: UserChannel
  }

  [EVENT_REMOVE_PRIMARY_CHANNEL]: {
    streamerId: number
    userChannel: UserChannel
  }

  [EVENT_STREAMLABS_DONATION]: {
    streamerId: number
    streamlabsDonation: StreamlabsDonation
  }

  [EVENT_PUBLIC_CHAT_ITEM]: ChatMessage

  [EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP]: {
    streamerId: number
    primaryUserId: number
    oldLevel: Level
    newLevel: Level
  }

  [EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER]: {
    streamerId: number
    userDisplayName: string
  }

  [EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION]: DonationWithUser

  [EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER]: {
    streamerId: number
    primaryUserId: number
  }

  [EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED]: {
    streamerId: number
    chatMessageId: number
  }

  [EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE]: {
    streamerId: number
    rankEvent: ParsedRankEvent
  }
}

export type DataPair<T extends keyof EventData> = [T, EventData[T]]

type Listener<T extends keyof EventData = any> = (data: EventData[T]) => any | Promise<any>

export default class EventDispatchService extends SingletonContextClass {
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

  public isListening<T extends keyof EventData> (type: T, listener: Listener<T>) {
    if (!this.listeners.has(type)) {
      return false
    } else {
      return this.listeners.get(type)!.includes(listener)
    }
  }

  /** Starts listening to data. The listener is responsible for catching all errors. */
  public onData<T extends keyof EventData> (type: T, listener: Listener<T>) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)!.push(listener)
  }

  /** Removes the listener for the event type. */
  public unsubscribe<T extends keyof EventData> (type: T, listener: Listener<T>) {
    if (!this.listeners.has(type)) {
      return
    }

    this.listeners.set(type, this.listeners.get(type)!.filter(l => l !== listener))
  }
}
