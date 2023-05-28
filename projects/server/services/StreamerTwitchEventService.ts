import HelixEventService, { EventSubType } from '@rebel/server/services/HelixEventService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { single } from '@rebel/shared/util/arrays'

export type SubscriptionType = EventSubType | 'chat'

export type SubscriptionStatus = {
  status: 'active' | 'pending' | 'inactive'
  lastChange: number

  // no message implies no error
  message?: string

  // if the subscription is not working properly, whether this can be fixed by obtaining (re-)authorisation from the streamer
  requiresAuthorisation?: boolean
}

type Deps = Dependencies<{
  helixEventService: HelixEventService
  twurpleService: TwurpleService
  streamerChannelStore: StreamerChannelStore
}>

export default class StreamerEventService extends ContextClass {
  private readonly helixEventService: HelixEventService
  private readonly twurpleService: TwurpleService
  private readonly streamerChannelStore: StreamerChannelStore

  constructor (deps: Deps) {
    super()
    this.helixEventService = deps.resolve('helixEventService')
    this.twurpleService = deps.resolve('twurpleService')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
  }

  /** Returns null if the streamer does not have a primary Twitch channel. */
  public async getStatuses (streamerId: number): Promise<Record<SubscriptionType, SubscriptionStatus> | null> {
    const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([streamerId]).then(single)
    if (primaryChannels.twitchChannel == null) {
      return null
    }

    const chatStatus = await this.twurpleService.getChatStatus(streamerId)
    if (chatStatus == null) {
      return null
    }

    const result = {
      ...this.helixEventService.getEventSubscriptions(streamerId),
      chat: chatStatus
    }
    return result
  }
}
