import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore, { AddUserRankArgs } from '@rebel/server/stores/RankStore'
import StreamerStore, { CreateApplicationArgs, StreamerApplicationWithUser } from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/shared/util/arrays'
import { UserAlreadyStreamerError } from '@rebel/shared/util/error'
import { TWITCH_SCOPE } from '@rebel/server/constants'
import WebService from '@rebel/server/services/WebService'
import LogService from '@rebel/server/services/LogService'
import { AccessToken } from '@twurple/auth/lib'
import AuthStore from '@rebel/server/stores/AuthStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import { getUserName } from '@rebel/server/services/ChannelService'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'

type Deps = Dependencies<{
  streamerStore: StreamerStore
  rankStore: RankStore
  accountStore: AccountStore
  studioUrl: string
  twitchClientId: string
  twitchClientSecret: string
  webService: WebService
  logService: LogService
  authStore: AuthStore
  streamerChannelStore: StreamerChannelStore
  twurpleAuthProvider: TwurpleAuthProvider
}>

export default class StreamerService extends ContextClass {
  readonly name = StreamerService.name

  private readonly streamerStore: StreamerStore
  private readonly rankStore: RankStore
  private readonly accountStore: AccountStore
  private readonly studioUrl: string
  private readonly twitchClientId: string
  private readonly twitchClientSecret: string
  private readonly webService: WebService
  private readonly logService: LogService
  private readonly authStore: AuthStore
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly twurpleAuthProvider: TwurpleAuthProvider

  constructor (deps: Deps) {
    super()
    this.streamerStore = deps.resolve('streamerStore')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.studioUrl = deps.resolve('studioUrl')
    this.twitchClientId = deps.resolve('twitchClientId')
    this.twitchClientSecret = deps.resolve('twitchClientSecret')
    this.webService = deps.resolve('webService')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.twurpleAuthProvider = deps.resolve('twurpleAuthProvider')
  }

  /** Note that new streamers do not have primary channels by default.
   * @throws {@link UserAlreadyStreamerError}: When the user whose application is to be approved is already a streamer.
   * @throws {@link StreamerApplicationAlreadyClosedError}: When attempting to close an application that has already been closed. */
  public async approveStreamerApplication (streamerApplicationId: number, message: string, loggedInRegisteredUserId: number): Promise<StreamerApplicationWithUser> {
    const updatedApplication = await this.streamerStore.closeStreamerApplication({ id: streamerApplicationId, message, approved: true })
    const streamer = await this.streamerStore.addStreamer(updatedApplication.registeredUserId)

    // add the owner rank to the aggregate chat user
    const registeredUser = await this.accountStore.getRegisteredUsersFromIds([streamer.registeredUserId]).then(single)
    const userRankArgs: AddUserRankArgs = {
      assignee: loggedInRegisteredUserId,
      expirationTime: null,
      message: `Streamer application ${streamerApplicationId} was approved.`,
      rank: 'owner',
      streamerId: streamer.id,
      primaryUserId: registeredUser.aggregateChatUserId
    }
    await this.rankStore.addUserRank(userRankArgs)

    return updatedApplication
  }

  /** @throws {@link UserAlreadyStreamerError}: When the user for which the application is to be created is already a streamer. */
  public async createStreamerApplication (registeredUserId: number, message: string): Promise<StreamerApplicationWithUser> {
    const existingStreamer = await this.streamerStore.getStreamerByRegisteredUserId(registeredUserId)
    if (existingStreamer != null) {
      throw new UserAlreadyStreamerError()
    }

    const data: CreateApplicationArgs = { registeredUserId, message}
    return await this.streamerStore.addStreamerApplication(data)
  }

  public getTwitchLoginUrl () {
    const scope = TWITCH_SCOPE.join('+')
    const redirectUrl = this.getRedirectUrl()

    // note: we don't store the authorisation code, but Studio needs to know whether the user authorisation succeeded,
    // and the presence of the code in the query params is one way of achieving this.
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${this.twitchClientId}&redirect_uri=${redirectUrl}&response_type=code&scope=${scope}`
    return url
  }

  /** Once the user has authorised ChatMate, this method gets an access token and saves it to the database. */
  public async authoriseTwitchLogin (streamerId: number, authorisationCode: string): Promise<void> {
    const primaryChannel = await this.streamerChannelStore.getPrimaryChannels([streamerId]).then(single)
    if (primaryChannel.twitchChannel == null) {
      throw new Error(`Could not find a primary Twitch channel for streamer ${streamerId}.`)
    }

    const redirectUrl = this.getRedirectUrl()
    const url = `https://id.twitch.tv/oauth2/token?client_id=${this.twitchClientId}&client_secret=${this.twitchClientSecret}&code=${authorisationCode}&grant_type=authorization_code&redirect_uri=${redirectUrl}`

    const rawResponse = await this.webService.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    if (!rawResponse.ok) {
      const message = `Twitch auth response was status ${rawResponse.status}: ${await rawResponse.text()}`
      this.logService.logError(this, `Failed to set Twitch access token for streamer ${streamerId}. ${message}`)
      throw new Error(message)
    }

    const response = await rawResponse.json() as any
    const token: AccessToken = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      scope: TWITCH_SCOPE,
      expiresIn: 0,
      obtainmentTimestamp: 0
    }

    const twitchChannelName = getUserName(primaryChannel.twitchChannel)
    const twitchUserId = primaryChannel.twitchChannel.platformInfo.channel.twitchId
    await this.authStore.saveTwitchAccessToken(twitchUserId, twitchChannelName, token)

    // invalidate the existing access token so that the next request will fetch the updated one
    this.twurpleAuthProvider.removeTokenForUser(twitchUserId)

    this.logService.logInfo(this, `Successfully updated Twitch access token for twitch channel '${twitchChannelName}'.`)
  }

  private getRedirectUrl () {
    return `${this.studioUrl}/manager`
  }
}
