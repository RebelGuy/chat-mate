import { TwitchLivestream, YoutubeLivestream } from '@prisma/client'
import AggregateLivestream from '@rebel/server/models/AggregateLivestream'
import { ChatPlatform } from '@rebel/server/models/chat'
import { isTwitchLivestream, isYoutubeLivestream } from '@rebel/server/models/livestream'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { assertUnreachable } from '@rebel/shared/util/typescript'

export type AggregateLivestreamParticipation = AggregateLivestream<{
  hasParticipated: boolean
}>

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  logService: LogService
}>

// for dealing with effective livestreams that are derived from the concrete youtube/twitch livestreams
export default class AggregateLivestreamService extends ContextClass {
  public readonly name = AggregateLivestreamService.name

  private readonly livestreamStore: LivestreamStore
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.logService = deps.resolve('logService')
  }

  /** Sorted in ascending order by start time. */
  public async getAggregateLivestreams (streamerId: number): Promise<AggregateLivestream[]> {
    const youtubeLivestreams = await this.livestreamStore.getYoutubeLivestreams(streamerId).then(streams => streams.filter(l => l.start != null))
    const twitchLivestreams = await this.livestreamStore.getTwitchLivestreams(streamerId)

    // sanity check we only have at most one stream on each platform still in-progress.
    // if this is not true, something is wrong and we shouldn't continue in order to protect data integrity
    const currentYoutubeLivestreams = youtubeLivestreams.filter(l => l.end == null).length
    const currentTwitchLivestreams = twitchLivestreams.filter(l => l.end == null).length
    if (currentYoutubeLivestreams > 1 || currentTwitchLivestreams > 1) {
      const message = `Unable to construct aggregate streams for streamer ${streamerId} because multiple current livestreams were detected (${currentYoutubeLivestreams} on Youtube and ${currentTwitchLivestreams} on Twitch).`
      this.logService.logError(this, message, youtubeLivestreams, twitchLivestreams)
      throw new Error(message)
    } else if (currentYoutubeLivestreams === 1 && youtubeLivestreams.at(-1)!.end != null) {
      const message = `Unable to construct aggregate streams for streamer ${streamerId} because the current Youtube livestream was in an unexpected position.`
      this.logService.logError(this, message, youtubeLivestreams)
      throw new Error(message)
    } else if (currentTwitchLivestreams === 1 && twitchLivestreams.at(-1)!.end != null) {
      const message = `Unable to construct aggregate streams for streamer ${streamerId} because the current Twitch livestream was in an unexpected position.`
      this.logService.logError(this, message, twitchLivestreams)
      throw new Error(message)
    }

    // make sure start time are monotonically increasing
    const allLivestreams = [...youtubeLivestreams, ...twitchLivestreams].sort(l => l.start!.getTime())

    let aggregateLivestreams: AggregateLivestream[] = []
    let currentLivestreams: (YoutubeLivestream | TwitchLivestream)[] = []
    let currentStartTime: Date | null = null
    let currentEndTime: Date | null = null
    for (const livestream of allLivestreams) {
      if (currentStartTime == null) {
        // start a new block
        currentStartTime = livestream.start
        currentEndTime = livestream.end
        currentLivestreams.push(livestream)

      } else if (currentEndTime == null) {
        // block is open-ended (still ongoing). don't need to compare times, all further livestreams will be added to this block
        currentEndTime = null
        currentLivestreams.push(livestream)

      } else if (livestream.start! <= currentEndTime) {
        // livestream overlaps with block and possibly extends it
        currentLivestreams.push(livestream)

        if (livestream.end == null) {
          currentEndTime = null
        } else {
          currentEndTime = livestream.end > currentEndTime! ? livestream.end : currentEndTime
        }

      } else if (livestream.start! > currentEndTime) {
        // finish off the block
        aggregateLivestreams.push(new AggregateLivestream(currentStartTime, currentEndTime, currentLivestreams))

        // start a new block
        currentStartTime = livestream.start
        currentEndTime = livestream.end
        currentLivestreams = [livestream]

      } else {
        const message = `Unable to construct aggregate streams for streamer ${streamerId}`
        this.logService.logError(this, message, livestream, currentLivestreams, currentStartTime, currentEndTime, youtubeLivestreams, twitchLivestreams)
        throw new Error(message)
      }
    }

    // finish off the block
    if (currentStartTime != null) {
      aggregateLivestreams.push(new AggregateLivestream(currentStartTime, currentEndTime, currentLivestreams))
    }

    return aggregateLivestreams
  }

  public async getLivestreamParticipation (streamerId: number, anyUserIds: number[]): Promise<AggregateLivestreamParticipation[]> {
    const participatedYoutubeLivestreams = await this.livestreamStore.getYoutubeLivestreamParticipation(streamerId, anyUserIds)
      .then(p => p.filter(l => l.participated))
    const participatedTwitchLivestreams = await this.livestreamStore.getTwitchLivestreamParticipation(streamerId, anyUserIds)
      .then(p => p.filter(l => l.participated))
    const aggregateLivestreams = await this.getAggregateLivestreams(streamerId)

    let aggregateLivestreamParticipations: AggregateLivestreamParticipation[] = []
    let youtubeIndex = 0
    let twitchIndex = 0
    for (const aggregateLivestream of aggregateLivestreams) {
      let hasParticipated = false

      for (let _; youtubeIndex < participatedYoutubeLivestreams.length; youtubeIndex++) {
        if (aggregateLivestream.includesLivestream(participatedYoutubeLivestreams[youtubeIndex].id, 'youtube')) {
          hasParticipated = true
        } else {
          break
        }
      }

      for (let _; twitchIndex < participatedTwitchLivestreams.length; twitchIndex++) {
        if (aggregateLivestream.includesLivestream(participatedTwitchLivestreams[twitchIndex].id, 'twitch')) {
          hasParticipated = true
        } else {
          break
        }
      }

      const data = { hasParticipated }
      aggregateLivestreamParticipations.push(aggregateLivestream.withDataReplaced(data))
    }

    return aggregateLivestreamParticipations
  }
}
