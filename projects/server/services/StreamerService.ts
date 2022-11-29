import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import HelixEventService from '@rebel/server/services/HelixEventService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore, { AddUserRankArgs } from '@rebel/server/stores/RankStore'
import StreamerStore, { CreateApplicationArgs, StreamerApplicationWithUser } from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/server/util/arrays'
import { UserAlreadyStreamerError, StreamerApplicationAlreadyClosedError } from '@rebel/server/util/error'

type Deps = Dependencies<{
  streamerStore: StreamerStore
  twurpleService: TwurpleService
  helixEventService: HelixEventService
  rankStore: RankStore
  accountStore: AccountStore
}>

export default class StreamerService extends ContextClass {
  private readonly streamerStore: StreamerStore
  private readonly twurpleService: TwurpleService
  private readonly helixEventService: HelixEventService
  private readonly rankStore: RankStore
  private readonly accountStore: AccountStore

  constructor (deps: Deps) {
    super()
    this.streamerStore = deps.resolve('streamerStore')
    this.twurpleService = deps.resolve('twurpleService')
    this.helixEventService = deps.resolve('helixEventService')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
  }

  /**
   * @throws {@link UserAlreadyStreamerError}: When the user whose application is to be approved is already a streamer.
   * @throws {@link StreamerApplicationAlreadyClosedError}: When attempting to close an application that has already been closed. */
  public async approveStreamerApplication (streamerApplicationId: number, message: string, loggedInRegisteredUserId: number): Promise<StreamerApplicationWithUser> {
    const updatedApplication = await this.streamerStore.closeStreamerApplication({ id: streamerApplicationId, message, approved: true })
    const streamer = await this.streamerStore.addStreamer(updatedApplication.registeredUserId)
    await this.twurpleService.joinChannel(streamer.id)
    await this.helixEventService.subscribeToChannelEvents(streamer.id)

    // add the owner rank. if the streamer doesn't have a linked chat user, we will add the rank later at the time of linking
    const registeredUser = single(await this.accountStore.getRegisteredUsersFromIds([streamer.registeredUserId]))
    if (registeredUser.chatUserId != null) {
      const userRankArgs: AddUserRankArgs = {
        assignee: loggedInRegisteredUserId,
        expirationTime: null,
        message: `Streamer application ${streamerApplicationId} was approved.`,
        rank: 'owner',
        streamerId: streamer.id,
        chatUserId: registeredUser.chatUserId
      }
      await this.rankStore.addUserRank(userRankArgs)
    }
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
}
