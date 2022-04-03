import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { NgrokAdapter } from '@twurple/eventsub-ngrok'
import { EventSubListener } from '@twurple/eventsub'
import FollowerService from '@rebel/server/services/FollowerService'

type Deps = Dependencies<{
  isLive: boolean
  twitchChannelName: string
  twurpleApiClientProvider: TwurpleApiClientProvider
  followerService: FollowerService
}>

/** This should only subscribe to and relay events to other services, but not do any work (other than some data transformations). */
export default class HelixEventService extends ContextClass {
  private readonly isLive: boolean
  private readonly twitchChannelName: string
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider

  private readonly followerService: FollowerService

  constructor (deps: Deps) {
    super()

    this.isLive = deps.resolve('isLive')
    this.twitchChannelName = deps.resolve('twitchChannelName')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.followerService = deps.resolve('followerService')
  }

  public override async initialise () {
    // https://twurple.js.org/docs/getting-data/eventsub/listener-setup.html
    // we have to use the clientCredentialsApiClient, for some reasont he refreshing one doesn't work
    const client = this.twurpleApiClientProvider.getClientApi()
    const listener = new EventSubListener({
      apiClient: client,
      adapter: new NgrokAdapter(),
      secret: `065adade-b312-11ec-b909-0242ac120002-${this.isLive}`
    })

    await listener.listen()
    const user = await client.users.getUserByName(this.twitchChannelName)

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    await listener.subscribeToChannelFollowEvents(user!.id, async (e) => await this.followerService.onNewFollower(e.userId, e.userName, e.userDisplayName))
  }
}
