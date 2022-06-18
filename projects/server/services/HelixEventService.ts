import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { NgrokAdapter } from '@twurple/eventsub-ngrok'
import { ConnectionAdapter, DirectConnectionAdapter, EventSubListener, EventSubMiddleware } from '@twurple/eventsub'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import LogService from '@rebel/server/services/LogService'
import { HelixEventSubApi, HelixUser } from '@twurple/api/lib'
import { disconnect, kill } from 'ngrok'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import FileService from '@rebel/server/services/FileService'
import { Express } from 'express-serve-static-core'
import { EventSubBase } from '@twurple/eventsub/lib/EventSubBase'

// Ngrok session expires automatically after this time. We can increase the session time by signing up, but
// there seems to be no way to pass the auth details to the adapter so we have to restart the session manually
// every now and then
const NGROK_MAX_SESSION = 3600 * 2 * 1000

type Deps = Dependencies<{
  disableExternalApis: boolean
  isLive: boolean
  isLocal: boolean
  twitchChannelName: string
  hostName: string | null
  twurpleApiClientProvider: TwurpleApiClientProvider
  followerStore: FollowerStore
  timerHelpers: TimerHelpers
  logService: LogService
  fileService: FileService
  app: Express
}>

/** This should only subscribe to and relay events to other services, but not do any work (other than some data transformations). */
export default class HelixEventService extends ContextClass {
  public readonly name = HelixEventService.name

  private readonly disableExternalApis: boolean
  private readonly isLive: boolean
  private readonly isLocal: boolean
  private readonly twitchChannelName: string
  private readonly hostName: string | null
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly followerStore: FollowerStore
  private readonly timerHelpers: TimerHelpers
  private readonly logService: LogService
  private readonly fileService: FileService
  private readonly app: Express

  // the broadcaster's User object
  private user!: HelixUser
  private listener: EventSubListener | null
  private eventSubApi!: HelixEventSubApi

  constructor (deps: Deps) {
    super()

    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.isLive = deps.resolve('isLive')
    this.isLocal = deps.resolve('isLocal')
    this.twitchChannelName = deps.resolve('twitchChannelName')
    this.hostName = deps.resolve('hostName')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.followerStore = deps.resolve('followerStore')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.logService = deps.resolve('logService')
    this.fileService = deps.resolve('fileService')
    this.app = deps.resolve('app')

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

    const user = await client.users.getUserByName(this.twitchChannelName)
    if (user == null) {
      throw new Error(`Could not get Twitch user '${this.twitchChannelName}. Please review the environment variables.'`)
    }
    this.user = user

    // from https://discuss.dev.twitch.tv/t/cancel-subscribe-webhook-events/21064/3
    // we have to go through our existing callbacks and terminate them, otherwise we won't be able to re-subscribe (HTTP 429 - "Too many requests")
    await this.eventSubApi.deleteAllSubscriptions()

    if (this.isLocal) {
      this.listener = this.createNewListener()
      await this.listener.listen()
      this.timerHelpers.createRepeatingTimer({ behaviour: 'start', interval: NGROK_MAX_SESSION * 0.9, callback: () => this.refreshNgrok() })
      await this.subscribeToEvents(this.listener)    
      this.logService.logInfo(this, 'Successfully subscribed to Helix events via the EventSub API [Ngrok listener]')
    } else {
      // can't use the listener - have to inject the middleware
      const middleware = new EventSubMiddleware({
        apiClient: this.twurpleApiClientProvider.getClientApi(),
        pathPrefix: '/twitch',
        hostName: this.hostName!,
        secret: this.getSecret()
      })
      await middleware.apply(this.app)

      // hack: only mark as ready once we are starting the app so no events get lost
      // - assume this happens in the next 5 seconds (generous delay - we are in no rush)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        await middleware.markAsReady()
        await this.subscribeToEvents(middleware)    
        this.logService.logInfo(this, 'Successfully subscribed to Helix events via the EventSub API [Middleware listener]')
      }, 5000)
      this.logService.logInfo(this, 'Subscription to Helix events via the EventSub API has been set up and will be initialised in 5 seconds')
    }
  }

  private async refreshNgrok () {
    try {
      // stop the current Ngrok server/tunnel
      await this.eventSubApi.deleteAllSubscriptions()
      await disconnect()
      await kill()

      // this will create a new Ngrok server/tunnel with a different address
      this.listener = this.createNewListener()
      await this.listener.listen()
      await this.subscribeToEvents(this.listener)
      this.logService.logInfo(this, 'Successfully refreshed the Ngrok server. The EventSub events will continue to work normally.')
    } catch (e) {
      this.logService.logError(this, 'Failed to refresh the Ngrok server. EventSub notifications will not be received for much longer. Please restart the application at your earliest convenience.', e)
    }
  }

  private async subscribeToEvents (eventSubBase: EventSubBase) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    await eventSubBase.subscribeToChannelFollowEvents(this.user.id, async (e) => await this.followerStore.saveNewFollower(e.userId, e.userName, e.userDisplayName))
  }

  private createNewListener () {
    return new EventSubListener({
      apiClient: this.twurpleApiClientProvider.getClientApi(),
      adapter: this.createAdapter(),
      secret: this.getSecret()
    })
  }

  private createAdapter (): ConnectionAdapter {
    if (this.isLocal) {
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
    return `065adade-b312-11ec-b909-0242ac120002-${this.isLive}-${this.isLocal}`
  }
}
