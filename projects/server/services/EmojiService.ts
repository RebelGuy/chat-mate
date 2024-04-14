import RankStore from '@rebel/server/stores/RankStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { unique } from '@rebel/shared/util/arrays'

type Deps = Dependencies<{
  rankStore: RankStore
}>

export default class EmojiService extends ContextClass {
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
  }

  /** Returns the ids of primary users that have access to use normal (i.e. non-custom) emojis. */
  public async getEligibleEmojiUsers (streamerId: number) {
    // todo: in the future, we will extend this to add some sort of permission system/config system to give the streamer control over who can use emojis
    const donators = await this.rankStore.getUserRanksForGroup('donation', streamerId)
    return unique(donators.map(d => d.primaryUserId))
  }
}
