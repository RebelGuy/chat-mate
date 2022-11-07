import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { NgrokAdapter } from '@twurple/eventsub-ngrok'
import { ConnectionAdapter, DirectConnectionAdapter, EventSubChannelFollowEvent, EventSubListener, EventSubMiddleware } from '@twurple/eventsub'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import LogService from '@rebel/server/services/LogService'
import { HelixEventSubApi, HelixUser } from '@twurple/api/lib'
import { disconnect, kill } from 'ngrok'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import FileService from '@rebel/server/services/FileService'
import { Express } from 'express-serve-static-core'
import { EventSubBase } from '@twurple/eventsub/lib/EventSubBase'
import { NodeEnv } from '@rebel/server/globals'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'

// Ngrok session expires automatically after this time. We can increase the session time by signing up, but
// there seems to be no way to pass the auth details to the adapter so we have to restart the session manually
// every now and then
const NGROK_MAX_SESSION = 3600 * 2 * 1000

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

  private listener: EventSubListener | null
  private eventSubBase!: EventSubBase
  private eventSubApi!: HelixEventSubApi

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

    this.listener = null
  }

  public override async initialise () {
    if (this.disableExternalApis) {
      return
    }

    // https://twurple.js.org/docs/getting-data/eventsub/listener-setup.html
    // we have to use the clientCredentialsApiClient, for some reasont he refreshing one doesn't work
    const client = this.twurpleApiClientProvider.getClientApi()
    this.eventSubApi = client.eventSub

    if (this.nodeEnv === 'local') {
      // from https://discuss.dev.twitch.tv/t/cancel-subscribe-webhook-events/21064/3
      // we have to go through our existing callbacks and terminate them, otherwise we won't be able to re-subscribe (HTTP 429 - "Too many requests")
      // this is explicitly required for ngrok as per the docs because ngrok assigns a new host name every time we run it
      await this.eventSubApi.deleteAllSubscriptions()

      this.listener = this.createNewListener()
      this.eventSubBase = this.listener
      await this.listener.listen()
      this.timerHelpers.createRepeatingTimer({ behaviour: 'start', interval: NGROK_MAX_SESSION * 0.9, callback: () => this.refreshNgrok() })
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
      await middleware.apply(this.app)

      // hack: only mark as ready once we are starting the app so no events get lost
      // - assume this happens in the next 5 seconds (generous delay - we are in no rush)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        await middleware.markAsReady()

        const subscriptions = await this.eventSubApi.getSubscriptions()
        const readableSubscriptions = subscriptions.data.map(s => `${s.type}: ${s.status}`)
        this.logService.logInfo(this, 'Retrieved', subscriptions.data.length, 'existing EventSub subscriptions:', readableSubscriptions)
        if (subscriptions.total !== subscriptions.data.length) {
          throw new Error('Time to implement pagination')
        }

        middleware.onVerify((success, subscription) => this.logService.logInfo(this, 'middleware.onVerify', 'success:', success, 'subscription:', subscription.id))
        middleware.onRevoke((subscription) => this.logService.logInfo(this, 'middleware.onRevoke', 'subscription:', subscription.id))

        // from what I understand we can safely re-subscribe to events when using the middleware
        await this.initialiseSubscriptions()
        this.logService.logInfo(this, 'Successfully subscribed to Helix events via the EventSub API [Middleware listener]')
      }, 5000)
      this.logService.logInfo(this, 'Subscription to Helix events via the EventSub API has been set up and will be initialised in 5 seconds')
    }
  }

  public async subscribeToChannelEvents (streamerId: number): Promise<void> {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      return
    }

    await this.subscribeToChannelEventsByChannelName(channelName)
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
      await this.listener.listen()
      await this.initialiseSubscriptions()
      this.logService.logInfo(this, 'Successfully refreshed the Ngrok server. The EventSub events will continue to work normally.')
    } catch (e) {
      this.logService.logError(this, 'Failed to refresh the Ngrok server. EventSub notifications will not be received for much longer. Please restart the application at your earliest convenience.', e)
    }
  }

  private async initialiseSubscriptions () {
    const channels = await this.streamerChannelService.getAllTwitchChannelNames()
    await Promise.all(channels.map(c => this.subscribeToChannelEventsByChannelName(c)))
  }

  private async subscribeToChannelEventsByChannelName (channelName: string) {
    const client = this.twurpleApiClientProvider.getClientApi()
    const user = await client.users.getUserByName(channelName)
    if (user == null) {
      throw new Error(`Could not get Twitch user '${channelName}' and could not subscribe to channel events`)
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    await this.eventSubBase.subscribeToChannelFollowEvents(user.id, async (e) => await this.followerStore.saveNewFollower(e.userId, e.userName, e.userDisplayName))
  }

  private createNewListener () {
    return new EventSubListener({
      apiClient: this.twurpleApiClientProvider.getClientApi(),
      adapter: this.createAdapter(),
      secret: this.getSecret()
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
