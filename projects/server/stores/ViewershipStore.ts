import { Livestream, LivestreamType, LiveViewers, ViewingBlock } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { LIVESTREAM_PARTICIPATION_TYPES } from '@rebel/server/services/ChannelService'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { addTime, maxTime, MAX_DATE, minTime } from '@rebel/server/util/datetime'
import { assertUnreachableCompile, reminder } from '@rebel/server/util/typescript'

// padding are in minutes
export const VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE = 5
export const VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER = 10

export type LivestreamParticipation = Livestream & { userId: number, participated: boolean }

export type LivestreamViewership = Livestream & { userId: number, viewed: boolean }

export type LastSeen = { livestream: Livestream, time: Date, viewingBlockId: number }

type Deps = Dependencies<{
  dbProvider: DbProvider
  livestreamStore: LivestreamStore
  logService: LogService
}>

export default class ViewershipStore extends ContextClass {
  public readonly name = ViewershipStore.name

  private readonly db: Db
  private readonly livestreamStore: LivestreamStore
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.logService = deps.resolve('logService')
  }

  public async addLiveViewCount (youtubeCount: number, twitchCount: number): Promise<void> {
    if (this.livestreamStore.activeLivestream == null) {
      this.logService.logWarning(this, 'Tried adding live view counts but there is no active public livestream')
      return
    }

    await this.db.liveViewers.create({ data: {
      livestream: { connect: { id: this.livestreamStore.activeLivestream.id }},
      youtubeViewCount: youtubeCount,
      twitchViewCount: twitchCount
    }})
  }

  /** Adds/extends a viewing block for this user for the given time. Ignores if there is viewing data AFTER the given time. (do not use for backfilling).
   * Adds generous padding on the left and right. Note that this is intentionally channel agnostic - we don't need to know about the
   * viewership of a specific *channel*.
   */
  public async addViewershipForChatParticipation (userId: number, timestamp: number): Promise<void> {
    if (this.livestreamStore.activeLivestream == null) {
      return
    }

    const startTime = this.livestreamStore.activeLivestream.start
    if (startTime == null) {
      // livestream hasn't started yet
      return
    }
    const endTime = this.livestreamStore.activeLivestream.end ?? MAX_DATE

    // get the viewing block range
    const _time = new Date(timestamp)
    const lowerTime = maxTime(addTime(_time, 'minutes', -VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE), startTime)
    const upperTime = minTime(addTime(_time, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER), endTime)

    const lastSeen = await this.getLastSeen(userId)
    if (lastSeen && lastSeen.time >= upperTime) {
      return
    }

    // create or update
    let block: ViewingBlock & { livestream: Livestream }
    if (lastSeen && lastSeen.time >= lowerTime) {
      // there is overlap - combine
      block = await this.db.viewingBlock.update({
        data: { lastUpdate: upperTime },
        where: { id: lastSeen.viewingBlockId},
        include: { livestream: true }
      })
    } else {
      block = await this.db.viewingBlock.create({
        data: {
          user: { connect: { id: userId }},
          livestream: { connect: { id: this.livestreamStore.activeLivestream.id }},
          startTime: lowerTime,
          lastUpdate: upperTime
        },
        include: { livestream: true }
      })
    }
  }

  /** Returns the time of the previous viewing block. */
  public async getLastSeen (userId: number): Promise<LastSeen | null> {
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

    return result
  }

  public async getLatestLiveCount (): Promise<{ time: Date, viewCount: number, twitchViewCount: number } | null> {
    if (this.livestreamStore.activeLivestream == null) {
      return null
    }

    const result = await this.db.liveViewers.findFirst({
      where: { livestreamId: this.livestreamStore.activeLivestream.id },
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

    // please add a test to ensure we don't add participation for chat messages in unlisted streams
    reminder<LivestreamType>({ publicLivestream: true })

    const livestreams = await this.db.livestream.findMany({
      include: {
        chatMessages: {
          where: { user: { id: userId }, livestream: { type: 'publicLivestream' }},
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
