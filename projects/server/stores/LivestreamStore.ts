import { YoutubeLivestream, TwitchLivestream } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { LIVESTREAM_PARTICIPATION_TYPES } from '@rebel/server/services/ChannelService'
import { assertUnreachableCompile } from '@rebel/shared/util/typescript'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'
import { Prisma } from '@prisma/client'

export type YoutubeLivestreamParticipation = YoutubeLivestream & { participated: boolean }

export type TwitchLivestreamParticipation = TwitchLivestream & { participated: boolean }

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

  public async addNewTwitchLivestream (streamerId: number): Promise<TwitchLivestream> {
    const currentLivestream = await this.getCurrentTwitchLivestream(streamerId)
    if (currentLivestream != null) {
      throw new ChatMateError(`Cannot add a new Twitch livestream for streamer ${streamerId} because a current livestream already exists`)
    }

    return await this.db.twitchLivestream.create({ data: {
      streamerId: streamerId,
      start: new Date()
    }})
  }

  /** Sets the streamer's current active Youtube livestream, if exists, to inactive such that `LivestreamStore.activeLivestream` returns null for that streamer. */
  public async deactivateYoutubeLivestream (streamerId: number): Promise<void> {
    const activeLivestream = await this.getActiveYoutubeLivestream(streamerId)
    if (activeLivestream == null) {
      return
    }

    // end it if live
    let end = activeLivestream.end
    if (end == null && activeLivestream.start != null) {
      end = new Date()
    }

    await this.db.youtubeLivestream.update({
      where: { liveId: activeLivestream.liveId },
      data: { isActive: false, end: end }
    })
  }

  /** Gets the streamer's Youtube livestream that is currently active, if any. */
  public async getActiveYoutubeLivestream (streamerId: number): Promise<YoutubeLivestream | null> {
    return await this.db.youtubeLivestream.findFirst({ where: {
      streamerId: streamerId,
      isActive: true
    }})
  }

  /** Gets the active Youtube livestreams across all streamers. */
  public async getActiveYoutubeLivestreams (): Promise<YoutubeLivestream[]> {
    return await this.db.youtubeLivestream.findMany({ where: {
      isActive: true
    }})
  }

  /** Returns the Twitch livestream that is currently in progress, if any. */
  public async getCurrentTwitchLivestream (streamerId: number): Promise<TwitchLivestream | null> {
    return await this.db.twitchLivestream.findFirst({ where: {
      streamerId: streamerId,
      end: null
    }})
  }

  /** Returns the current Twitch livestreams across all streamers, that is, livestreams that have not yet ended. */
  public async getCurrentTwitchLivestreams (): Promise<TwitchLivestream[]> {
    return await this.db.twitchLivestream.findMany({ where: {
      end: null
    }})
  }

  /** Returns the latest Twitch livestream that is not current. */
  public async getPreviousTwitchLivestream (streamerId: number): Promise<TwitchLivestream | null> {
    return await this.db.twitchLivestream.findFirst({
      where: {
        streamerId: streamerId,
        end: { not: null }
      },
      orderBy: {
        end: 'desc'
      }
    })
  }

  /** Gets the list of the streamer's Youtube livestreams since the given time, sorted by time in ascending order (with not-yet-started livestreams placed at the end). */
  public async getYoutubeLivestreams (streamerId: number, since: number): Promise<YoutubeLivestream[]> {
    const orderedLivestreams = await this.db.youtubeLivestream.findMany({
      where: {
        streamerId: streamerId,
        OR: [
          { end: null },
          { end: { gte: new Date(since) }}
        ]
      },
      orderBy: { start: 'asc' }
    })

    // it places livestreams with null start time at the beginning, but we want them at the end
    let result = orderedLivestreams.filter(l => l.start != null)
    result.push(...orderedLivestreams.filter(l => l.start == null))
    return result
  }

  /** Gets the list of the streamer's Twitch livestreams since the given time, sorted by time in ascending order. */
  public async getTwitchLivestreams (streamerId: number, since: number): Promise<TwitchLivestream[]> {
    const orderedLivestreams = await this.db.twitchLivestream.findMany({
      where: {
        streamerId: streamerId,
        OR: [
          { end: null },
          { end: { gte: new Date(since) }}
        ]
      },
      orderBy: { start: 'asc' }
    })

    return orderedLivestreams
  }

  public async getYoutubeTotalDaysLivestreamed (since: number): Promise<number> {
    const queryResult = await this.db.$queryRaw<{ duration: Prisma.Decimal | null }[]>`
      SELECT SUM(UNIX_TIMESTAMP(COALESCE(end, UTC_TIMESTAMP())) - GREATEST(UNIX_TIMESTAMP(start), ${since / 1000})) / 3600 / 24 AS duration FROM youtube_livestream
      WHERE end IS NULL OR end >= ${new Date(since)};
    `

    return single(queryResult).duration?.toNumber() ?? 0
  }

  public async getTwitchTotalDaysLivestreamed (since: number): Promise<number> {
    const queryResult = await this.db.$queryRaw<{ duration: Prisma.Decimal | null }[]>`
      SELECT SUM(UNIX_TIMESTAMP(COALESCE(end, UTC_TIMESTAMP())) - GREATEST(UNIX_TIMESTAMP(start), ${since / 1000})) / 3600 / 24 AS duration FROM twitch_livestream
      WHERE end IS NULL OR end >= ${new Date(since)};
    `

    return single(queryResult).duration?.toNumber() ?? 0
  }

  /** Sets the streamer's given livestream as active, such that `LivestreamStore.activeYoutubeLivestream` returns this stream.
   * Please ensure you deactivate the previous livestream first, if applicable. Failure to do so will throw an error. */
  public async setActiveYoutubeLivestream (streamerId: number, liveId: string): Promise<YoutubeLivestream> {
    const activeLivestream = await this.getActiveYoutubeLivestream(streamerId)
    if (activeLivestream != null) {
      if (activeLivestream.liveId === liveId) {
        return activeLivestream
      } else {
        throw new ChatMateError(`Cannot set an active livestream for streamer ${streamerId} while another livestream is already active. Please ensure you deactivate the existing livestream first.`)
      }
    }

    return await this.db.youtubeLivestream.upsert({
      create: { liveId, streamerId, createdAt: new Date(), isActive: true },
      update: { isActive: true },
      where: { liveId }
    })
  }

  public async setYoutubeContinuationToken (liveId: string, continuationToken: string | null): Promise<YoutubeLivestream | null> {
    return await this.db.youtubeLivestream.update({
      where: { liveId },
      data: { continuationToken }
    })
  }

  public async setYoutubeLivestreamTimes (liveId: string, updatedTimes: Pick<YoutubeLivestream, 'start' | 'end'>): Promise<YoutubeLivestream | null> {
    return await this.db.youtubeLivestream.update({
      where: { liveId },
      data: { ...updatedTimes }
    })
  }

  public async setTwitchLivestreamTimes (twitchLivestreamId: number, updatedTimes: Pick<TwitchLivestream, 'start' | 'end'>): Promise<TwitchLivestream | null> {
    return await this.db.twitchLivestream.update({
      where: { id: twitchLivestreamId },
      data: { ...updatedTimes }
    })
  }

  public async addYoutubeLiveViewCount (youtubeLivestreamId: number, viewCount: number): Promise<void> {
    await this.db.youtubeLiveViewers.create({ data: {
      youtubeLivestream: { connect: { id: youtubeLivestreamId }},
      viewCount: viewCount
    }})
  }

  public async addTwitchLiveViewCount (twitchLivestreamId: number, viewCount: number): Promise<void> {
    await this.db.twitchLiveViewers.create({ data: {
      twitchLivestream: { connect: { id: twitchLivestreamId }},
      viewCount: viewCount
    }})
  }

  public async getLatestYoutubeLiveCount (youtubeLivestreamId: number): Promise<{ time: Date, viewCount: number } | null> {
    const result = await this.db.youtubeLiveViewers.findFirst({
      where: { youtubeLivestreamId: youtubeLivestreamId },
      orderBy: { time: 'desc' }
    })

    if (result) {
      return {
        time: result.time,
        viewCount: result.viewCount
      }
    } else {
      return null
    }
  }

  public async getLatestTwitchLiveCount (twitchLivestreamId: number): Promise<{ time: Date, viewCount: number } | null> {
    const result = await this.db.twitchLiveViewers.findFirst({
      where: { twitchLivestreamId: twitchLivestreamId },
      orderBy: { time: 'desc' }
    })

    if (result) {
      return {
        time: result.time,
        viewCount: result.viewCount
      }
    } else {
      return null
    }
  }

  /** Returns streams in ascending order where any of the given user ids have participated in the livestream.
 * The following actions are considered participation:
 * - sending a message in chat */
  public async getYoutubeLivestreamParticipation (streamerId: number, anyUserIds: number[]): Promise<YoutubeLivestreamParticipation[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    const livestreams = await this.db.youtubeLivestream.findMany({
      where: { streamerId },
      include: {
        chatMessages: {
          where: {
            user: { id: { in: anyUserIds } }
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

  /** Returns streams in ascending order where any of the given user ids have participated in the livestream.
 * The following actions are considered participation:
 * - sending a message in chat */
  public async getTwitchLivestreamParticipation (streamerId: number, anyUserIds: number[]): Promise<TwitchLivestreamParticipation[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    const livestreams = await this.db.twitchLivestream.findMany({
      where: { streamerId },
      include: {
        chatMessages: {
          where: {
            user: { id: { in: anyUserIds } },
          },
          take: 1 // order doesn't matter
        }
      },
      orderBy: { start: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      participated: l.chatMessages.length > 0
    }))
  }
}
