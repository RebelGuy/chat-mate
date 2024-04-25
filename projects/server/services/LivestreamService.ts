import { LiveStatus, MasterchatError, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import LogService from '@rebel/server/services/LogService'
import MasterchatService from '@rebel/server/services/MasterchatService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { addTime } from '@rebel/shared/util/datetime'
import { TwitchMetadata } from '@rebel/server/services/TwurpleService'
import { TwitchLivestream, YoutubeLivestream } from '@prisma/client'
import CacheService from '@rebel/server/services/CacheService'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import { ChatMateError } from '@rebel/shared/util/error'

export const METADATA_SYNC_INTERVAL_MS = 12_000

const STREAM_CONTINUITY_ALLOWANCE = 5 * 60_000

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  masterchatService: MasterchatService
  twurpleApiProxyService: TwurpleApiProxyService
  logService: LogService
  timerHelpers: TimerHelpers
  disableExternalApis: boolean
  dateTimeHelpers: DateTimeHelpers
  streamerChannelService: StreamerChannelService
  cacheService: CacheService
  chatMateStateService: ChatMateStateService
}>

export default class LivestreamService extends ContextClass {
  readonly name: string = LivestreamService.name

  private readonly livestreamStore: LivestreamStore
  private readonly masterchatService: MasterchatService
  private readonly twurpleApiProxyService: TwurpleApiProxyService
  private readonly logService: LogService
  private readonly timerHelpers: TimerHelpers
  private readonly disableExternalApis: boolean
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly streamerChannelService: StreamerChannelService
  private readonly cacheService: CacheService
  private readonly chatMateStateService: ChatMateStateService

  constructor (deps: Deps) {
    super()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchatService = deps.resolve('masterchatService')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.streamerChannelService = deps.resolve('streamerChannelService')
    this.cacheService = deps.resolve('cacheService')
    this.chatMateStateService = deps.resolve('chatMateStateService')
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    const activeLivestreams = await this.livestreamStore.getActiveYoutubeLivestreams()
    await Promise.all(activeLivestreams.map(l => this.masterchatService.addMasterchat(l.streamerId, l.liveId)))

    const timerOptions: TimerOptions = {
      behaviour: 'end',
      callback: () => this.updateAllMetadata(),
      interval: METADATA_SYNC_INTERVAL_MS
    }
    await this.timerHelpers.createRepeatingTimer(timerOptions, true)
  }

  /** Sets the streamer's current Youtube livestream as inactive, also removing the associated masterchat instance. */
  public async deactivateYoutubeLivestream (streamerId: number) {
    const activeLivestream = await this.livestreamStore.getActiveYoutubeLivestream(streamerId)
    if (activeLivestream == null) {
      return
    }

    await this.livestreamStore.deactivateYoutubeLivestream(streamerId)
    this.masterchatService.removeMasterchat(streamerId)
    this.logService.logInfo(this, `Youtube livestream with id ${activeLivestream.liveId} for streamer ${streamerId} has been deactivated.`)
  }

  /** Sets the given Youtube livestream as active for the streamer, and creates a masterchat instance.
   * Please ensure you deactivate the previous Youtube livestream first, if applicable.
   * Attempts of activating a livestream that is from a different channel than the streamer's primary channel will throw. */
  public async setActiveYoutubeLivestream (streamerId: number, liveId: string) {
    const streamerYoutubeChannelId = await this.streamerChannelService.getYoutubeExternalId(streamerId)
    if (streamerYoutubeChannelId == null) {
      throw new ChatMateError('No primary YouTube channel has been set for the streamer.')
    }

    const livestreamYoutubeChannelId = await this.masterchatService.getChannelIdFromAnyLiveId(liveId)
    if (streamerYoutubeChannelId !== livestreamYoutubeChannelId) {
      throw new ChatMateError(`The given Youtube livestream does not belong to the streamer's primary YouTube channel.`)
    }

    await this.livestreamStore.setActiveYoutubeLivestream(streamerId, liveId)
    await this.masterchatService.addMasterchat(streamerId, liveId)
    this.logService.logInfo(this, `Youtube livestream with id ${liveId} for streamer ${streamerId} has been activated.`)
  }

  public async onTwitchLivestreamStarted (streamerId: number) {
    const currentStream = await this.livestreamStore.getCurrentTwitchLivestream(streamerId)
    if (currentStream != null) {
      this.logService.logWarning(this, `A new Twitch livestream for streamer ${streamerId} has supposedly started, but another stream is still active. Ignoring.`)
      return
    }

    const previousStream = await this.livestreamStore.getPreviousTwitchLivestream(streamerId)
    const previousEndTime = previousStream?.end!.getTime() ?? 0
    if (previousStream != null && this.dateTimeHelpers.ts() - previousEndTime <= STREAM_CONTINUITY_ALLOWANCE) {
      // re-activate the previous stream
      await this.livestreamStore.setTwitchLivestreamTimes(previousStream.id, { start: previousStream?.start, end: null })
      this.logService.logInfo(this, `A new Twitch livestream for streamer ${streamerId} has started shortly after the previous one (id ${previousStream.id} finished. Re-activating the previous livestream.`)
    } else {
      // create a new stream
      const newStream = await this.livestreamStore.addNewTwitchLivestream(streamerId)
      this.logService.logInfo(this, `A new Twitch livestream for streamer ${streamerId} has started (livestream id ${newStream.id}).`)
    }
  }

  public async onTwitchLivestreamEnded (streamerId: number) {
    const livestream = await this.livestreamStore.getCurrentTwitchLivestream(streamerId)
    if (livestream == null) {
      throw new ChatMateError(`Cannot set the livestream end time for streamer ${streamerId} because no current livestream exists.`)
    }

    await this.livestreamStore.setTwitchLivestreamTimes(livestream.id, { start: livestream.start, end: this.dateTimeHelpers.now() })
    this.logService.logInfo(this, `The Twitch livestream for streamer ${streamerId} has ended (livestream id ${livestream.id}).`)
  }

  private async updateAllMetadata () {
    const isInitialFetch = !this.chatMateStateService.hasInitialisedLivestreamMetadata()
    if (isInitialFetch) {
      this.chatMateStateService.onInitialisedLivestreamMetadata()
    }

    const activeYoutubeLivestreams = await this.livestreamStore.getActiveYoutubeLivestreams()
    await Promise.all(activeYoutubeLivestreams.map(l => this.updateYoutubeLivestreamMetadata(l)))

    const currentTwitchLivestreams = await this.livestreamStore.getCurrentTwitchLivestreams()
    if (isInitialFetch) {
      this.logService.logInfo(this, 'Syncing Twitch livestreams...')
      await this.syncTwitchLiveStatus(currentTwitchLivestreams)
      this.logService.logInfo(this, 'Completed syncing Twitch livestreams.')
    } else {
      await Promise.all(currentTwitchLivestreams.map(l => this.updateTwitchLivestreamMetadata(l)))
    }
  }

  private async updateYoutubeLivestreamMetadata (livestream: YoutubeLivestream) {
    // no point in fetching metadata for the official ChatMate streamer since it will never go live
    const chatMateStreamerId = await this.cacheService.chatMateStreamerId.resolve()
    if (chatMateStreamerId === livestream.streamerId) {
      return
    }

    if (livestream.end != null && this.dateTimeHelpers.now() > addTime(livestream.end, 'minutes', 2)) {
      // automatically deactivate public livestream after stream has ended - fetching chat will error out anyway
      // (after some delay), so there is no need to keep it around.
      this.logService.logInfo(this, `Automatically deactivating current Youtube livestream with id ${livestream.liveId} for streamer ${livestream.streamerId} because it has ended.`)
      await this.deactivateYoutubeLivestream(livestream.streamerId)
      return
    }

    const youtubeMetadata = await this.fetchYoutubeMetadata(livestream.streamerId)
    if (youtubeMetadata == null) {
      // failed to fetch metadata
      return
    }

    try {
      const updatedTimes = this.getUpdatedYoutubeLivestreamTimes(livestream, youtubeMetadata)

      if (updatedTimes) {
        await this.livestreamStore.setYoutubeLivestreamTimes(livestream.liveId, updatedTimes)
      }

      if (youtubeMetadata.liveStatus === 'live' && youtubeMetadata.viewerCount != null) {
        await this.livestreamStore.addYoutubeLiveViewCount(livestream.id, youtubeMetadata.viewerCount)
      }
    } catch (e: any) {
      this.logService.logError(this, `Encountered error while syncing Youtube metadata for livestream ${livestream.liveId} for streamer ${livestream.streamerId}.`, e)
    }
  }

  /** Returns null if something went wrong. */
  private async fetchYoutubeMetadata (streamerId: number): Promise<Metadata | null> {
    try {
      return await this.masterchatService.fetchMetadata(streamerId)
    } catch (e: any) {
      if (e instanceof MasterchatError) {
        // we won't be able to recover from this - deactivate
        this.logService.logError(this, `Cannot fetch Youtube metadata for streamer ${streamerId} because of a masterchat error. Deactivating livestream.`, e.name, e.message)
        await this.deactivateYoutubeLivestream(streamerId)
      } else {
        this.logService.logError(this, `Encountered error while fetching Youtube metadata for streamer ${streamerId}.`, e.message)
      }
      return null
    }
  }

  private getUpdatedYoutubeLivestreamTimes (existingLivestream: YoutubeLivestream, metadata: Metadata): Pick<YoutubeLivestream, 'start' | 'end'> | null {
    const newStatus = metadata.liveStatus
    if (newStatus === 'unknown') {
      this.logService.logWarning(this, `Tried to update livestream times, but current live status was reported as 'unkown'. Won't attempt to update livestream times.`)
      return null
    }

    const existingStatus = LivestreamService.getYoutubeLivestreamStatus(existingLivestream)
    if (existingStatus === 'finished' && newStatus !== 'finished' || existingStatus === 'live' && newStatus === 'not_started') {
      // invalid status
      throw new ChatMateError(`Unable to update livestream times because current status '${existingStatus}' is incompatible with new status '${newStatus}'.`)
    } else if (existingStatus === newStatus) {
      return null
    } else if (existingStatus === 'not_started' && newStatus === 'live') {
      // just started
      this.logService.logInfo(this, 'Livestream has started')
      return {
        start: this.dateTimeHelpers.now(),
        end: existingLivestream.end
      }
    } else if (existingStatus === 'not_started' && newStatus === 'finished') {
      // should not happen, but not impossible
      this.logService.logWarning(this, 'Livestream has finished before it started - 0 duration')
      return {
        start: this.dateTimeHelpers.now(),
        end: this.dateTimeHelpers.now()
      }
    } else if (existingStatus === 'live' && newStatus === 'finished') {
      // just finished
      this.logService.logInfo(this, 'Livestream has finished')
      return {
        start: existingLivestream.start,
        end: this.dateTimeHelpers.now()
      }
    } else {
      throw new ChatMateError('Did not expect to get here')
    }
  }

  private static getYoutubeLivestreamStatus (livestream: YoutubeLivestream): Exclude<LiveStatus, 'unknown'> {
    if (livestream.start == null && livestream.end == null) {
      return 'not_started'
    } else if (livestream.start != null && livestream.end == null) {
      return 'live'
    } else if (livestream.start != null && livestream.end != null && livestream.start < livestream.end) {
      return 'finished'
    } else {
      throw new ChatMateError(`Could not determine livestream status based on start time ${livestream.start} and end time ${livestream.end}`)
    }
  }

  private async syncTwitchLiveStatus (currentLivestreams: TwitchLivestream[]) {
    const twitchChannels = await this.streamerChannelService.getAllTwitchStreamerChannels()

    for (const twitchChannel of twitchChannels) {
      const streamerId = twitchChannel.streamerId
      const expectedCurrentLivestream = currentLivestreams.find(l => l.streamerId === streamerId)

      try {
        const twitchMetadata = await this.fetchTwitchMetadata(streamerId)
        if (twitchMetadata == null && expectedCurrentLivestream == null) {
          continue
        } else if (twitchMetadata != null && expectedCurrentLivestream != null) {
          this.logService.logInfo(this, `Syncing Twitch live status. Streamer ${streamerId} is still live while we weren't listening`)
          await this.livestreamStore.addTwitchLiveViewCount(expectedCurrentLivestream.id, twitchMetadata.viewerCount)
        } else if (twitchMetadata == null && expectedCurrentLivestream != null) {
          this.logService.logInfo(this, `Syncing Twitch live status. Streamer ${streamerId} went offline on Twitch while we weren't listening`)
          await this.onTwitchLivestreamEnded(streamerId)
        } else if (twitchMetadata != null && expectedCurrentLivestream == null) {
          this.logService.logInfo(this, `Syncing Twitch live status. Streamer ${streamerId} went live on Twitch while we weren't listening`)
          await this.onTwitchLivestreamStarted(streamerId)
        }

      } catch (e: any) {
        this.logService.logError(this, `Encountered error while initialising Twitch metadata for streamer ${streamerId}.`, e)
      }
    }
  }

  private async updateTwitchLivestreamMetadata (currentLivestream: TwitchLivestream) {
    try {
      const twitchMetadata = await this.fetchTwitchMetadata(currentLivestream.streamerId)

      // update the end time if the stream has ended
      if (twitchMetadata == null) {
        const updatedTimes = {
          start: currentLivestream.start,
          end: this.dateTimeHelpers.now()
        }
        await this.livestreamStore.setTwitchLivestreamTimes(currentLivestream.id, updatedTimes)
        this.logService.logInfo(this, `Inferred that the Twitch livestream for streamer ${currentLivestream.streamerId} has ended.`)

      // otherwise, update the viewer count
      } else {
        await this.livestreamStore.addTwitchLiveViewCount(currentLivestream.id, twitchMetadata.viewerCount)
      }
    } catch (e: any) {
      this.logService.logError(this, `Encountered error while syncing Twitch metadata for streamer ${currentLivestream.streamerId}.`, e)
    }
  }

  /** Returns null if no stream is active for the streamer. Throws if something went wrong. */
  private async fetchTwitchMetadata (streamerId: number): Promise<TwitchMetadata | null> {
    const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
    if (channelName == null) {
      throw new ChatMateError(`Streamer ${streamerId} does not have a primary Twitch channel.`)
    }

    return await this.twurpleApiProxyService.fetchMetadata(streamerId, channelName)
  }
}
