import { Livestream, ViewingBlock } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'

export type LivestreamParticipation = Livestream & { channelId: string, participated: boolean }

export type LivestreamViewership = Livestream & { channelId: string, viewed: boolean }

export type LastSeen = { livestream: Livestream, time: Date, viewingBlockId: number }

/** The maximum time between two viewership events such that they can still be merged into a single viewing block */
export const VIEWERSHIP_SNAPPING_MS = 90 * 1000

type Deps = Dependencies<{
  dbProvider: DbProvider
  livestreamStore: LivestreamStore
}>

export default class ExperienceStore {
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore

  // caches last-seens so we don't have to constantly re-query, which could lead to race conditions
  private readonly lastSeenMap: Map<string, LastSeen | null>

  constructor (deps: Deps) {
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.lastSeenMap = new Map()
  }

  /** Adds/extends a viewing block for this channel for the given time. Ignores if there is viewing data AFTER the given time. (do not use for backfilling) */
  public async addViewershipForChannel (channelId: string, timestamp: number): Promise<void> {
    let cachedLastSeen = this.lastSeenMap.get(channelId)
    const time = new Date(timestamp)

    if (cachedLastSeen && cachedLastSeen.time >= time) {
      return
    } else if (cachedLastSeen === undefined) {
      cachedLastSeen = await this.getLastSeen(channelId)
    }

    // create or update
    let block: ViewingBlock & { livestream: Livestream }
    if (cachedLastSeen && time > cachedLastSeen.time &&
      time.getTime() - cachedLastSeen.time.getTime() <= VIEWERSHIP_SNAPPING_MS
    ) {
      block = await this.db.viewingBlock.update({
        data: { lastUpdate: time },
        where: { id: cachedLastSeen.viewingBlockId},
        include: { livestream: true }
      })
    } else {
      block = await this.db.viewingBlock.create({ data: {
        channel: { connect: { youtubeId: channelId }},
        livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
        startTime: time,
        lastUpdate: time
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
