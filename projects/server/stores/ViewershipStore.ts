import { Livestream, LivestreamType, ViewingBlock } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { LIVESTREAM_PARTICIPATION_TYPES } from '@rebel/server/services/ChannelService'
import { addTime, maxTime, MAX_DATE, minTime } from '@rebel/server/util/datetime'
import { assertUnreachableCompile, reminder } from '@rebel/server/util/typescript'

// padding are in minutes
export const VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE = 5
export const VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER = 10

export type LivestreamParticipation = Livestream & { participated: boolean }

export type LivestreamViewership = Livestream & { viewed: boolean }

export type LastSeen = { livestream: Livestream, time: Date, viewingBlockId: number }

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ViewershipStore extends ContextClass {
  public readonly name = ViewershipStore.name

  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  public async addLiveViewCount (livestreamId: number, youtubeCount: number, twitchCount: number): Promise<void> {
    await this.db.liveViewers.create({ data: {
      livestream: { connect: { id: livestreamId }},
      youtubeViewCount: youtubeCount,
      twitchViewCount: twitchCount
    }})
  }

  /** Adds/extends a viewing block for this user for the given time. Ignores if there is viewing data AFTER the given time. (do not use for backfilling).
   * Adds generous padding on the left and right. Note that this is intentionally channel agnostic - we don't need to know about the
   * viewership of a specific *channel*.
   */
  public async addViewershipForChatParticipation (livestream: Livestream, userId: number, timestamp: number): Promise<void> {
    const startTime = livestream.start
    if (startTime == null) {
      // livestream hasn't started yet
      return
    }
    const endTime = livestream.end ?? MAX_DATE

    // get the viewing block range
    const _time = new Date(timestamp)
    const lowerTime = maxTime(addTime(_time, 'minutes', -VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE), startTime)
    const upperTime = minTime(addTime(_time, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER), endTime)

    const lastSeen = await this.getLastSeen(livestream.streamerId, userId)
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
          livestream: { connect: { id: livestream.id }},
          startTime: lowerTime,
          lastUpdate: upperTime
        },
        include: { livestream: true }
      })
    }
  }

  /** Returns the time of the previous viewing block. */
  public async getLastSeen (streamerId: number, userId: number): Promise<LastSeen | null> {
    const block = await this.db.viewingBlock.findFirst({
      where: {
        user: { id: userId },
        livestream: { streamerId }
      },
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

  public async getLatestLiveCount (livestreamId: number): Promise<{ time: Date, viewCount: number, twitchViewCount: number } | null> {
    const result = await this.db.liveViewers.findFirst({
      where: { livestreamId: livestreamId },
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
  public async getLivestreamParticipation (streamerId: number, userIds: number[]): Promise<LivestreamParticipation[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    // please add a test to ensure we don't add participation for chat messages in unlisted streams
    reminder<LivestreamType>({ publicLivestream: true })

    const livestreams = await this.db.livestream.findMany({
      where: { streamerId },
      include: {
        chatMessages: {
          where: {
            user: { id: { in: userIds } },
            livestream: { type: 'publicLivestream', streamerId }
          },
          take: 1 // order doesn't matter
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      participated: l.chatMessages.length > 0
    }))
  }

  /** Returns streams in ascending order. */
  public async getLivestreamViewership (streamerId: number, userIds: number[]): Promise<LivestreamViewership[]> {
    const livestreams = await this.db.livestream.findMany({
      where: { streamerId },
      include: {
        viewingBlocks: {
          where: { user: { id: { in: userIds } }},
          take: 1 // order doesn't matter
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      viewed: l.viewingBlocks.length > 0
    }))
  }
}
