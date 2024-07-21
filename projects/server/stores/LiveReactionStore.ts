import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class LiveReactionStore extends SingletonContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  async addLiveReaction (streamerId: number, emojiId: number, reactionCount: number): Promise<void> {
    await this.db.liveReaction.create({ data: {
      streamerId: streamerId,
      emojiId: emojiId,
      count: reactionCount
    }})
  }

  async getTotalLiveReactions (): Promise<number> {
    const result = await this.db.liveReaction.aggregate({
      _sum: { count: true }
    })

    return result._sum.count ?? 0
  }
}
