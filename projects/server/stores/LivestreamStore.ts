import { Livestream, LivestreamType } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { LIVESTREAM_PARTICIPATION_TYPES } from '@rebel/server/services/ChannelService'
import { assertUnreachableCompile, reminder } from '@rebel/server/util/typescript'

export type LivestreamParticipation = Livestream & { participated: boolean }

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class LivestreamStore extends ContextClass {
  readonly name: string = LivestreamStore.name

  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  /** Sets the streamer's current active livestream to inactive such that `LivestreamStore.activeLivestream` returns null for that streamer. */
  public async deactivateLivestream (streamerId: number): Promise<void> {
    const activeLivestream = await this.getActiveLivestream(streamerId)
    if (activeLivestream == null) {
      return
    }

    await this.db.livestream.update({
      where: { liveId: activeLivestream.liveId },
      data: { isActive: false }
    })
  }

  /** Gets the streamer's public livestream that is currently active. */
  public async getActiveLivestream (streamerId: number): Promise<Livestream | null> {
    return await this.db.livestream.findFirst({ where: {
      streamerId: streamerId,
      isActive: true,
      type: 'publicLivestream'
    }})
  }

  /** Gets the active public livestreams across all streamers. */
  public async getActiveLivestreams (): Promise<Livestream[]> {
    return await this.db.livestream.findMany({ where: {
      isActive: true,
      type: 'publicLivestream'
    }})
  }

  /** Gets the list of all of the streamer's livestreams, sorted by time in ascending order (with no-yet-started livestreams placed at the end). */
  public async getLivestreams (streamerId: number): Promise<Livestream[]> {
    const orderedLivestreams = await this.db.livestream.findMany({
      where: { streamerId },
      orderBy: { start: 'asc' }
    })

    // it places livestreams with null start time at the beginning, but we want them at the end
    let result = orderedLivestreams.filter(l => l.start != null)
    result.push(...orderedLivestreams.filter(l => l.start == null))
    return result
  }

  // todo: in the future, we can pass more options into this function, e.g. if a livestream is considered unlisted
  /** Sets the streamer's given livestream as active, such that `LivestreamStore.activeLivestream` returns this stream.
   * Please ensure you deactivate the previous livestream first, if applicable. */
  public async setActiveLivestream (streamerId: number, liveId: string, type: LivestreamType): Promise<Livestream> {
    const activeLivestream = await this.getActiveLivestream(streamerId)
    if (activeLivestream != null) {
      if (activeLivestream.liveId === liveId) {
        return activeLivestream
      } else {
        throw new Error(`Cannot set an active livestream for streamer ${streamerId} while another livestream is already active. Please ensure you deactivate the existing livestream first.`)
      }
    }

    return await this.db.livestream.upsert({
      create: { liveId, streamerId, createdAt: new Date(), isActive: true, type },
      update: { isActive: true },
      where: { liveId }
    })
  }

  public async setContinuationToken (liveId: string, continuationToken: string | null): Promise<Livestream | null> {
    return await this.db.livestream.update({
      where: { liveId },
      data: { continuationToken }
    })
  }

  public async setTimes (liveId: string, updatedTimes: Pick<Livestream, 'start' | 'end'>): Promise<Livestream | null> {
    return await this.db.livestream.update({
      where: { liveId },
      data: { ...updatedTimes }
    })
  }

  public async addLiveViewCount (livestreamId: number, youtubeCount: number, twitchCount: number): Promise<void> {
    await this.db.liveViewers.create({ data: {
      livestream: { connect: { id: livestreamId }},
      youtubeViewCount: youtubeCount,
      twitchViewCount: twitchCount
    }})
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

  /** Returns streams in ascending order where any of the given user ids have participated in the livestream.
 * The following actions are considered participation:
 * - sending a message in chat */
  public async getLivestreamParticipation (streamerId: number, anyUserIds: number[]): Promise<LivestreamParticipation[]> {
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
            user: { id: { in: anyUserIds } },
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
}
