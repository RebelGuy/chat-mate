import EventDispatchService, { EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER } from '@rebel/server/services/EventDispatchService'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  eventDispatchService: EventDispatchService
  followerStore: FollowerStore
}>

export default class FollowerService extends ContextClass {
  private readonly eventDispatchService: EventDispatchService
  private readonly followerStore: FollowerStore

  constructor (deps: Deps) {
    super()

    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.followerStore = deps.resolve('followerStore')
  }

  public async saveNewFollower (streamerId: number, twitchUserId: string, userName: string, userDisplayName: string) {
    const existingFollower = await this.followerStore.getFollower(streamerId, twitchUserId)
    if (existingFollower != null) {
      return
    }

    await this.followerStore.saveNewFollower(streamerId, twitchUserId, userName, userDisplayName)
    void this.eventDispatchService.addData(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, { streamerId, userDisplayName })
  }
}
