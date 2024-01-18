import { YoutubeLivestream, TwitchLivestream } from '@prisma/client'
import { ChatPlatform } from '@rebel/server/models/chat'
import { isYoutubeLivestream, isTwitchLivestream } from '@rebel/server/models/livestream'
import { assertUnreachable } from '@rebel/shared/util/typescript'

/** Represents a collection of livestreams by a streamer on either platform which overlap in time. */
export default class AggregateLivestream<TData = never> {
  public readonly startTime: Date
  public readonly endTime: Date | null
  public readonly data: TData

  /* The livestreams (ordered by start time) making up this aggregate livestream. Contains at least one item.
  Does not include Youtube streams that haven't started yet, but may include in-progress streams. */
  public readonly livestreams: ReadonlyArray<(YoutubeLivestream | TwitchLivestream)>

  constructor (startTime: Date, endTime: Date | null, livestreams: ReadonlyArray<(YoutubeLivestream | TwitchLivestream)>, data?: TData) {
    this.startTime = startTime
    this.endTime = endTime
    this.livestreams = livestreams
    this.data = data as TData
  }

  public withDataReplaced<NewTData> (data: NewTData) {
    return new AggregateLivestream(this.startTime, this.endTime, this.livestreams, data)
  }

  public getYoutubeLivestreams () {
    return this.livestreams.filter(isYoutubeLivestream)
  }

  public getTwitchLivestreams () {
    return this.livestreams.filter(isTwitchLivestream)
  }

  public includesLivestream (livestreamId: number, platform: ChatPlatform): boolean {
    if (platform === 'youtube') {
      return this.getYoutubeLivestreams().find(l => l.id === livestreamId) != null
    } else if (platform === 'twitch') {
      return this.getTwitchLivestreams().find(l => l.id === livestreamId) != null
    } else {
      assertUnreachable(platform)
    }
  }

  public includesTimestamp (timestamp: number) {
    if (this.startTime.getTime() > timestamp) {
      return false
    }

    if (this.endTime == null) {
      return true
    } else {
      return this.endTime.getTime() > timestamp
    }
  }
}
