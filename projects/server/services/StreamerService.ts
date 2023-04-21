import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore, { AddUserRankArgs } from '@rebel/server/stores/RankStore'
import StreamerStore, { CreateApplicationArgs, StreamerApplicationWithUser } from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/shared/util/arrays'
import { UserAlreadyStreamerError } from '@rebel/shared/util/error'
import { TWITCH_SCOPE } from '@rebel/server/constants'

type Deps = Dependencies<{
  streamerStore: StreamerStore
  rankStore: RankStore
  accountStore: AccountStore
  studioUrl: string
  twitchClientId: string
}>

export default class StreamerService extends ContextClass {
  private readonly streamerStore: StreamerStore
  private readonly rankStore: RankStore
  private readonly accountStore: AccountStore
  private readonly studioUrl: string
  private readonly twitchClientId: string

  constructor (deps: Deps) {
    super()
    this.streamerStore = deps.resolve('streamerStore')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.studioUrl = deps.resolve('studioUrl')
    this.twitchClientId = deps.resolve('twitchClientId')
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

  private getRedirectUrl () {
    return `${this.studioUrl}/manager`
  }
}
