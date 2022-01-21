import { Livestream, LiveViewers, ViewingBlock } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { addTime, maxTime, MAX_DATE, minTime } from '@rebel/server/util/datetime'

// padding are in minutes
export const VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE = 5
export const VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER = 10

export type LivestreamParticipation = Livestream & { channelId: string, participated: boolean }

export type LivestreamViewership = Livestream & { channelId: string, viewed: boolean }

export type LastSeen = { livestream: Livestream, time: Date, viewingBlockId: number }

type Deps = Dependencies<{
  dbProvider: DbProvider
  livestreamStore: LivestreamStore
}>

export default class ViewershipStore {
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore

  // caches last-seens so we don't have to constantly re-query, which could lead to race conditions
  private readonly lastSeenMap: Map<string, LastSeen | null>

  constructor (deps: Deps) {
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.lastSeenMap = new Map()
  }

  public async addLiveViewCount (count: number): Promise<void> {
    await this.db.liveViewers.create({ data: {
      livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
      viewCount: count
    }})
  }

  /** Adds/extends a viewing block for this channel for the given time. Ignores if there is viewing data AFTER the given time. (do not use for backfilling).
   * Adds generous padding on the left and right
   */
  public async addViewershipForChatParticipation (channelId: string, timestamp: number): Promise<void> {
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

    let cachedLastSeen = this.lastSeenMap.get(channelId)
    if (cachedLastSeen === undefined) {
      cachedLastSeen = await this.getLastSeen(channelId)
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
      block = await this.db.viewingBlock.create({ data: {
        channel: { connect: { youtubeId: channelId }},
        livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
        startTime: lowerTime,
        lastUpdate: upperTime
        },
        include: { livestream: true }
      })
    }

    this.lastSeenMap.set(channelId, {
      viewingBlockId: block.id,
      livestream: block.livestream,
      time: block.lastUpdate
    })
  }

  // returns the time of the previous viewing block
  public async getLastSeen (channelId: string): Promise<LastSeen | null> {
    if (this.lastSeenMap.has(channelId)) {
      return this.lastSeenMap.get(channelId)!
    }

    const block = await this.db.viewingBlock.findFirst({
      where: { channel: { youtubeId: channelId }},
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

    this.lastSeenMap.set(channelId, result)
    return result
  }

  public async getLatestLiveCount (): Promise<{ time: Date, viewCount: number } | null> {
    return this.db.liveViewers.findFirst({
      where: { livestreamId: this.livestreamStore.currentLivestream.id },
      orderBy: { time: 'desc' }
    })
  }

  // returns streams in ascending order.
  // the following actions are considered participation:
  // - sending a message in chat
  public async getLivestreamParticipation (channelId: string): Promise<LivestreamParticipation[]> {
    const livestreams = await this.db.livestream.findMany({
      include: {
        chatMessages: {
          where: { channel: { youtubeId: channelId }},
          take: 1
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      channelId,
      participated: l.chatMessages.length > 0
    }))
  }

  // returns streams in ascending order
  public async getLivestreamViewership (channelId: string): Promise<LivestreamViewership[]> {
    const livestreams = await this.db.livestream.findMany({
      include: {
        viewingBlocks: {
          where: { channel: { youtubeId: channelId }},
          take: 1
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      channelId,
      viewed: l.viewingBlocks.length > 0
    }))
  }
}
