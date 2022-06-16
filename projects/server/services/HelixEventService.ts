import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { NgrokAdapter } from '@twurple/eventsub-ngrok'
import { ConnectionAdapter, DirectConnectionAdapter, EventSubListener } from '@twurple/eventsub'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import LogService from '@rebel/server/services/LogService'
import { HelixEventSubApi, HelixUser } from '@twurple/api/lib'
import { disconnect, kill } from 'ngrok'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import FileService from '@rebel/server/services/FileService'

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

  // the broadcaster's User object
  private user!: HelixUser
  private listener!: EventSubListener
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
  }

  public override async initialise () {
    if (this.disableExternalApis) {
      return
    }

    // https://twurple.js.org/docs/getting-data/eventsub/listener-setup.html
    // we have to use the clientCredentialsApiClient, for some reasont he refreshing one doesn't work
    const client = this.twurpleApiClientProvider.getClientApi()
    this.eventSubApi = client.eventSub
    this.listener = this.createNewListener()
    const userPromise = client.users.getUserByName(this.twitchChannelName)

    // from https://discuss.dev.twitch.tv/t/cancel-subscribe-webhook-events/21064/3
    // we have to go through our existing callbacks and terminate them, otherwise we won't be able to re-subscribe (HTTP 429 - "Too many requests")
    await this.eventSubApi.deleteAllSubscriptions()
    await this.listener.listen()
    this.user = (await userPromise)!
    await this.subscribeToEvents()

    if (this.isLocal) {
      this.timerHelpers.createRepeatingTimer({ behaviour: 'start', interval: NGROK_MAX_SESSION * 0.9, callback: () => this.refreshNgrok() })
    }

    this.logService.logInfo(this, 'Successfully subscribed to Helix events via the EventSub API')
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
      await this.subscribeToEvents()
      this.logService.logInfo(this, 'Successfully refreshed the Ngrok server. The EventSub events will continue to work normally.')
    } catch (e) {
      this.logService.logError(this, 'Failed to refresh the Ngrok server. EventSub notifications will not be received for much longer. Please restart the application at your earliest convenience.', e)
    }
  }

  private async subscribeToEvents () {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    await this.listener.subscribeToChannelFollowEvents(this.user.id, async (e) => await this.followerStore.saveNewFollower(e.userId, e.userName, e.userDisplayName))
  }

  private createNewListener () {
    return new EventSubListener({
      apiClient: this.twurpleApiClientProvider.getClientApi(),
      adapter: this.createAdapter(),
      secret: `065adade-b312-11ec-b909-0242ac120002-${this.isLive}-${this.isLocal}`
    })
  }

  private createAdapter (): ConnectionAdapter {
    if (this.isLocal) {
      // debug the Ngrok server at http://localhost:4040/inspect/http
      return new NgrokAdapter()
    } else {
      const key = this.fileService.read('key.pem')
      if (key == null) {
        throw new Error(`Unable to read SSL private key because the 'key.pem' file could not be found`)
      }

      const cert = this.fileService.read('certificate.pem')
      if (cert == null) {
        throw new Error(`Unable to read SSL certificate because the 'certificate.pem' file could not be found`)
      }

      return new DirectConnectionAdapter({
        hostName: this.hostName!,
        sslCert: { key, cert }
      })
    }
  }
}
