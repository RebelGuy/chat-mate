import { Livestream, LiveViewers, ViewingBlock } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { LIVESTREAM_PARTICIPATION_TYPES } from '@rebel/server/services/ChannelService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { addTime, maxTime, MAX_DATE, minTime } from '@rebel/server/util/datetime'
import { assertUnreachableCompile } from '@rebel/server/util/typescript'

// padding are in minutes
export const VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE = 5
export const VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER = 10

export type LivestreamParticipation = Livestream & { userId: number, participated: boolean }

export type LivestreamViewership = Livestream & { userId: number, viewed: boolean }

export type LastSeen = { livestream: Livestream, time: Date, viewingBlockId: number }

type Deps = Dependencies<{
  dbProvider: DbProvider
  livestreamStore: LivestreamStore
}>

export default class ViewershipStore extends ContextClass {
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore

  // caches last-seen users so we don't have to constantly re-query, which could lead to race conditions
  private readonly lastSeenMap: Map<number, LastSeen | null>

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.lastSeenMap = new Map()
  }

  public async addLiveViewCount (youtubeCount: number, twitchCount: number): Promise<void> {
    await this.db.liveViewers.create({ data: {
      livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
      youtubeViewCount: youtubeCount,
      twitchViewCount: twitchCount
    }})
  }

  /** Adds/extends a viewing block for this user for the given time. Ignores if there is viewing data AFTER the given time. (do not use for backfilling).
   * Adds generous padding on the left and right. Note that this is intentionally channel agnostic - we don't need to know about the
   * viewership of a specific *channel*.
   */
  public async addViewershipForChatParticipation (userId: number, timestamp: number): Promise<void> {
    const startTime = this.livestreamStore.currentLivestream.start
    if (startTime == null) {
      // livestream hasn't started yet
      return
    }
    const endTime = this.livestreamStore.currentLivestream.end ?? MAX_DATE

    // get the viewing block range
    const _time = new Date(timestamp)
    const lowerTime = maxTime(addTime(_time, 'minutes', -VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE), startTime)
    const upperTime = minTime(addTime(_time, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER), endTime)

    let cachedLastSeen = this.lastSeenMap.get(userId)
    if (cachedLastSeen === undefined) {
      cachedLastSeen = await this.getLastSeen(userId)
    }
    if (cachedLastSeen && cachedLastSeen.time >= upperTime) {
      return
    }

    // create or update
    let block: ViewingBlock & { livestream: Livestream }
    if (cachedLastSeen && cachedLastSeen.time >= lowerTime) {
      // there is overlap - combine
      block = await this.db.viewingBlock.update({
        data: { lastUpdate: upperTime },
        where: { id: cachedLastSeen.viewingBlockId},
        include: { livestream: true }
      })
    } else {
      block = await this.db.viewingBlock.create({
        data: {
          user: { connect: { id: userId }},
          livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
          startTime: lowerTime,
          lastUpdate: upperTime
        },
        include: { livestream: true }
      })
    }

    this.lastSeenMap.set(userId, {
      viewingBlockId: block.id,
      livestream: block.livestream,
      time: block.lastUpdate
    })
  }

  /** Returns the time of the previous viewing block. */
  public async getLastSeen (userId: number): Promise<LastSeen | null> {
    if (this.lastSeenMap.has(userId)) {
      return this.lastSeenMap.get(userId)!
    }

    const block = await this.db.viewingBlock.findFirst({
      where: { user: { id: userId }},
      orderBy: { lastUpdate: 'desc'},
      include: { livestream: true }
    })

    let result: LastSeen | null
    if (block) {
      result = {
        livestream: block.livestream,
        time: block.lastUpdate,
        viewingBlockId: block.id
      }
    } else {
      result = null
    }

    this.lastSeenMap.set(userId, result)
    return result
  }

  public async getLatestLiveCount (): Promise<{ time: Date, viewCount: number, twitchViewCount: number } | null> {
    const result = await this.db.liveViewers.findFirst({
      where: { livestreamId: this.livestreamStore.currentLivestream.id },
      orderBy: { time: 'desc' }
    })

    if (result) {
      return {
        time: result.time,
        viewCount: result.youtubeViewCount,
        twitchViewCount: result.twitchViewCount
      }
    } else {
      return null
    }
  }

  /** Returns streams in ascending order.
   * The following actions are considered participation:
   * - sending a message in chat */
  public async getLivestreamParticipation (userId: number): Promise<LivestreamParticipation[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    const livestreams = await this.db.livestream.findMany({
      include: {
        chatMessages: {
          where: { user: { id: userId }},
          take: 1 // order doesn't matter
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      userId,
      participated: l.chatMessages.length > 0
    }))
  }

  /** Returns streams in ascending order. */
  public async getLivestreamViewership (userId: number): Promise<LivestreamViewership[]> {
    const livestreams = await this.db.livestream.findMany({
      include: {
        viewingBlocks: {
          where: { user: { id: userId }},
          take: 1 // order doesn't matter
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      userId,
      viewed: l.viewingBlocks.length > 0
    }))
  }
}
