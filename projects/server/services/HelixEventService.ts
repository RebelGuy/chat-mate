import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { NgrokAdapter } from '@twurple/eventsub-ngrok'
import { ConnectionAdapter, DirectConnectionAdapter, EventSubHttpListener, EventSubMiddleware } from '@twurple/eventsub-http'
import { EventSubSubscription } from '@twurple/eventsub-base'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import LogService from '@rebel/server/services/LogService'
import { HelixEventSubApi } from '@twurple/api/lib'
import { disconnect, kill } from 'ngrok'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import FileService from '@rebel/server/services/FileService'
import { Express } from 'express-serve-static-core'
import { EventSubHttpBase } from '@twurple/eventsub-http/lib/EventSubHttpBase'
import { NodeEnv } from '@rebel/server/globals'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import EventDispatchService, { EventData } from '@rebel/server/services/EventDispatchService'
import { getUserName } from '@rebel/server/services/ChannelService'
import { SubscriptionStatus } from '@rebel/server/services/StreamerTwitchEventService'

// Ngrok session expires automatically after this time. We can increase the session time by signing up, but
// there seems to be no way to pass the auth details to the adapter so we have to restart the session manually
// every now and then
const NGROK_MAX_SESSION = 3600 * 2 * 1000

const EVENT_SUB_TYPES = ['followers'] as const

export type EventSubType = (typeof EVENT_SUB_TYPES)[number]

type Deps = Dependencies<{
  disableExternalApis: boolean
  nodeEnv: NodeEnv
  hostName: string | null
  twurpleApiClientProvider: TwurpleApiClientProvider
  followerStore: FollowerStore
  timerHelpers: TimerHelpers
  logService: LogService
  fileService: FileService
  app: Express
  streamerChannelService: StreamerChannelService
  eventDispatchService: EventDispatchService
  twitchClientId: string
  isAdministrativeMode: () => boolean
}>

// this class is so complicated, I don't want to write unit tests for it because the unit tests themselves would also be complicated, which defeats the purpose.
// if it ain't broken, don't fix it

/** This should only subscribe to and relay events to other services, but not do any work (other than some data transformations). */
export default class HelixEventService extends ContextClass {
  public readonly name = HelixEventService.name

  private readonly disableExternalApis: boolean
  private readonly nodeEnv: NodeEnv
  private readonly hostName: string | null
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly followerStore: FollowerStore
  private readonly timerHelpers: TimerHelpers
  private readonly logService: LogService
  private readonly fileService: FileService
  private readonly app: Express
  private readonly streamerChannelService: StreamerChannelService
  private readonly eventDispatchService: EventDispatchService
  private readonly twitchClientId: string
  private readonly isAdministrativeMode: () => boolean

  private listener: EventSubHttpListener | null
  private eventSubBase!: EventSubHttpBase
  private eventSubApi!: HelixEventSubApi
  private streamerSubscriptions: Map<number, Partial<Record<EventSubType, EventSubSubscription<any>>>> = new Map()

  constructor (deps: Deps) {
    super()

    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.nodeEnv = deps.resolve('nodeEnv')
    this.hostName = deps.resolve('hostName')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.followerStore = deps.resolve('followerStore')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.logService = deps.resolve('logService')
    this.fileService = deps.resolve('fileService')
    this.app = deps.resolve('app')
    this.streamerChannelService = deps.resolve('streamerChannelService')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.twitchClientId = deps.resolve('twitchClientId')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')

    this.listener = null
  }

  public override async initialise () {
    if (this.disableExternalApis) {
      return
    } else if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    // https://twurple.js.org/docs/getting-data/eventsub/listener-setup.html
    // we have to use the clientCredentialsApiClient, for some reason the refreshing one doesn't work
    const client = this.twurpleApiClientProvider.getClientApi()
    this.eventSubApi = client.eventSub

    if (this.nodeEnv === 'local') {
      // from https://discuss.dev.twitch.tv/t/cancel-subscribe-webhook-events/21064/3
      // we have to go through our existing callbacks and terminate them, otherwise we won't be able to re-subscribe (HTTP 429 - "Too many requests")
      // this is explicitly required for ngrok as per the docs because ngrok assigns a new host name every time we run it
      await this.eventSubApi.deleteAllSubscriptions()

      this.listener = this.createNewListener()
      this.eventSubBase = this.listener
      this.listener.start()
      this.timerHelpers.createRepeatingTimer({ behaviour: 'start', interval: NGROK_MAX_SESSION * 0.9, callback: () => this.refreshNgrok() })
      this.subscribeToGlobalEvents()
      await this.initialiseSubscriptions()
      this.logService.logInfo(this, 'Successfully subscribed to Helix events via the EventSub API [Ngrok listener]')
    } else {
      // can't use the listener - have to inject the middleware
      const middleware = new EventSubMiddleware({
        apiClient: this.twurpleApiClientProvider.getClientApi(),
        pathPrefix: '/twitch',
        hostName: this.hostName!,
        secret: this.getSecret()
      })
      this.eventSubBase = middleware
      middleware.apply(this.app)
      this.subscribeToGlobalEvents()

      // hack: only mark as ready once we are starting the app so no events get lost
      // - assume this happens in the next 5 seconds (generous delay - we are in no rush)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        try {
          await middleware.markAsReady()

          const subscriptions = await this.eventSubApi.getSubscriptions()
          const readableSubscriptions = subscriptions.data.map(s => `${s.type}: ${s.status}`)
          this.logService.logInfo(this, 'Retrieved', subscriptions.data.length, 'existing EventSub subscriptions:', readableSubscriptions)
          if (subscriptions.total !== subscriptions.data.length) {
            throw new Error('Time to implement pagination')
          }

          // from what I understand we can safely re-subscribe to events when using the middleware
          await this.initialiseSubscriptions()
          this.logService.logInfo(this, 'Finished initial subscriptions to Helix events via the EventSub API [Middleware listener]')
        } catch (e) {
          this.logService.logError(this, 'Failed to initialise Helix events.', e)
        }
      }, 5000)
      this.logService.logInfo(this, 'Subscription to Helix events via the EventSub API has been set up and will be initialised in 5 seconds')
    }

    this.eventDispatchService.onData('addPrimaryChannel', data => this.onPrimaryChannelAdded(data))
    this.eventDispatchService.onData('removePrimaryChannel', data => this.onPrimaryChannelRemoved(data))
  }

  public getEventSubscriptions (streamerId: number): Record<EventSubType, SubscriptionStatus> {
    const result = {} as Record<EventSubType, SubscriptionStatus>
    EVENT_SUB_TYPES.map(type => result[type] = { status: 'inactive' })

    const subscriptions = this.streamerSubscriptions.get(streamerId) ?? {}
    for (const type of EVENT_SUB_TYPES) {
      const subscription = subscriptions[type]
      if (subscription != null) {
        result[type] = { status: 'active' }
      }
    }

    return result
  }

  private subscribeToGlobalEvents () {
    // todo: momentarily listen to these when creating/removing subscriptions to find out whether the subscription succeeded or not, then update in-memory data
    // idea: make a map of subscription id -> status and update the status based on the below events. the status will be removed if the subscription gets removed.
    this.eventSubBase.onVerify((success, subscription) => this.logService.logInfo(this, 'eventSub.onVerify', 'success:', success, 'subscription:', subscription.id))
    this.eventSubBase.onRevoke((subscription) => this.logService.logWarning(this, 'eventSub.onRevoke', 'subscription:', subscription.id))
    this.eventSubBase.onSubscriptionCreateSuccess((subscription) => this.logService.logInfo(this, 'eventSub.onSubscriptionCreateSuccess', 'subscription:', subscription.id))
    this.eventSubBase.onSubscriptionCreateFailure((subscription, error) => this.logService.logError(this, 'eventSub.onSubscriptionCreateFailure', 'subscription:', subscription.id, error))
    this.eventSubBase.onSubscriptionDeleteSuccess((subscription) => this.logService.logInfo(this, 'eventSub.onSubscriptionDeleteSuccess', 'subscription:', subscription.id))
    this.eventSubBase.onSubscriptionDeleteFailure((subscription, error) => this.logService.logError(this, 'eventSub.onSubscriptionDeleteFailure', 'subscription:', subscription.id, error))

    // todo: add/remove all subscriptions when this happens
    this.eventSubBase.onUserAuthorizationGrant(this.twitchClientId, (data) => this.logService.logInfo(this, 'eventSub.onUserAuthorizationGrant', data.userDisplayName))
    this.eventSubBase.onUserAuthorizationRevoke(this.twitchClientId, (data) => this.logService.logWarning(this, 'eventSub.onUserAuthorizationRevoke', data.userDisplayName))

    this.logService.logInfo(this, 'Subscribed to base events')
  }

  private async onPrimaryChannelAdded (data: EventData['addPrimaryChannel']) {
    if (data.userChannel.platformInfo.platform !== 'twitch') {
      return
    }

    await this.subscribeToChannelEventsByChannelName(data.streamerId, getUserName(data.userChannel))
  }

  private async onPrimaryChannelRemoved (data: EventData['removePrimaryChannel']) {
    if (data.userChannel.platformInfo.platform !== 'twitch') {
      return
    }

    await this.unsubscribeFromChannelEvents(data.streamerId)
  }

  private async refreshNgrok () {
    try {
      // stop the current Ngrok server/tunnel
      await this.eventSubApi.deleteAllSubscriptions()
      await disconnect()
      await kill()

      // this will create a new Ngrok server/tunnel with a different address
      this.listener = this.createNewListener()
      this.eventSubBase = this.listener
      this.listener.start()
      await this.initialiseSubscriptions()
      this.logService.logInfo(this, 'Successfully refreshed the Ngrok server. The EventSub events will continue to work normally.')
    } catch (e) {
      this.logService.logError(this, 'Failed to refresh the Ngrok server. EventSub notifications will not be received for much longer. Please restart the application at your earliest convenience.', e)
    }
  }

  private async initialiseSubscriptions () {
    const streamerChannels = await this.streamerChannelService.getAllTwitchStreamerChannels()
    await Promise.all(streamerChannels.map(c => this.subscribeToChannelEventsByChannelName(c.streamerId, c.twitchChannelName)))
  }

  private async subscribeToChannelEventsByChannelName (streamerId: number, channelName: string) {
    const client = this.twurpleApiClientProvider.getClientApi()
    const user = await client.users.getUserByName(channelName)
    if (user == null) {
      this.logService.logError(this, `Failed to get Twitch user '${channelName}' (streamer ${streamerId}) and thus could not subscribe to channel events`)
      return
    }

    try {
      const moderatorUserId = user.id // todo CHAT-444: use the ChatMate user. if the streamer didn't give us moderator permissions, we won't be able to subscribe to moderator events.
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      const subscription = this.eventSubBase.onChannelFollow(user.id, moderatorUserId, async (e) => await this.followerStore.saveNewFollower(streamerId, e.userId, e.userName, e.userDisplayName))
      this.onSubscriptionAdded(streamerId, channelName, 'followers', subscription)
    } catch (e: any) {
      const subscribedTypes = Object.keys(this.streamerSubscriptions.get(streamerId) ?? {})
      this.logService.logError(this, `Failed to subscribe to all channel events of Twitch user '${channelName}' (streamer ${streamerId}).`, 'Active subscriptions:', subscribedTypes, 'Error:', e)
    }
  }

  private async unsubscribeFromChannelEvents (streamerId: number) {
    if (!this.streamerSubscriptions.has(streamerId)) {
      return
    }

    try {
      const subscriptions = this.streamerSubscriptions.get(streamerId)!
      const subscribedTypes = Object.keys(subscriptions) as (keyof typeof subscriptions)[]
      await Promise.all(subscribedTypes.map(type => subscriptions[type]!.stop()))
      this.streamerSubscriptions.delete(streamerId)
      this.logService.logInfo(this, `Unsubscribed from all channel events of streamer ${streamerId}`)
    } catch (e: any) {
      const subscribedTypes = Object.keys(this.streamerSubscriptions.get(streamerId) ?? {})
      this.logService.logError(this, `Failed to unsubscribe from all channel events of streamer ${streamerId}.`, 'Active subscriptions:', subscribedTypes, 'Error:', e)
    }
  }

  private onSubscriptionAdded (streamerId: number, channelName: string, type: EventSubType, subscription: EventSubSubscription) {
    if (!this.streamerSubscriptions.has(streamerId)) {
      this.streamerSubscriptions.set(streamerId, {})
    }

    this.streamerSubscriptions.get(streamerId)![type] = subscription
    this.logService.logInfo(this, `Subscribed to '${type}' events for Twitch user '${channelName}' (streamer ${streamerId})`)
  }

  private createNewListener () {
    return new EventSubHttpListener({
      apiClient: this.twurpleApiClientProvider.getClientApi(),
      adapter: this.createAdapter(),
      secret: this.getSecret(),
      legacySecrets: 'migrate'
    })
  }

  private createAdapter (): ConnectionAdapter {
    if (this.nodeEnv === 'local') {
      // debug the Ngrok server at http://localhost:4040/inspect/http
      return new NgrokAdapter()
    } else {
      // this doesn't work - don't create an adapter when deploying the server, instead, use the EventSub middleware
      const key = this.fileService.read('./server/key.pem')
      if (key == null) {
        throw new Error(`Unable to read SSL private key because the 'key.pem' file could not be found`)
      }

      const cert = this.fileService.read('./server/certificate.pem')
      if (cert == null) {
        throw new Error(`Unable to read SSL certificate because the 'certificate.pem' file could not be found`)
      }

      return new DirectConnectionAdapter({
        hostName: this.hostName!,
        sslCert: { key, cert }
      })
    }
  }

  private getSecret (): string {
    return `065adade-b312-11ec-b909-0242ac120002-${this.nodeEnv}`
  }
}
