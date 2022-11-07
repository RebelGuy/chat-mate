import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import HelixEventService from '@rebel/server/services/HelixEventService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import StreamerStore, { CreateApplicationArgs, StreamerApplicationWithUser } from '@rebel/server/stores/StreamerStore'
import { UserAlreadyStreamerError, StreamerApplicationAlreadyClosedError } from '@rebel/server/util/error'

type Deps = Dependencies<{
  streamerStore: StreamerStore
  twurpleService: TwurpleService
  helixEventService: HelixEventService
}>

export default class StreamerService extends ContextClass {
  private readonly streamerStore: StreamerStore
  private readonly twurpleService: TwurpleService
  private readonly helixEventService: HelixEventService

  constructor (deps: Deps) {
    super()
    this.streamerStore = deps.resolve('streamerStore')
    this.twurpleService = deps.resolve('twurpleService')
    this.helixEventService = deps.resolve('helixEventService')
  }

  /**
   * @throws {@link UserAlreadyStreamerError}: When the user whose application is to be approved is already a streamer.
   * @throws {@link StreamerApplicationAlreadyClosedError}: When attempting to close an application that has already been closed. */
  public async approveStreamerApplication (streamerApplicationId: number, message: string): Promise<StreamerApplicationWithUser> {
    const updatedApplication = await this.streamerStore.closeStreamerApplication({ id: streamerApplicationId, message, approved: true })
    const streamer = await this.streamerStore.addStreamer(updatedApplication.registeredUserId)
    await this.twurpleService.joinChannel(streamer.id)
    await this.helixEventService.subscribeToChannelEvents(streamer.id)
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