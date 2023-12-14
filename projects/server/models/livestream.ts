import { YoutubeLivestream, TwitchLivestream } from '@prisma/client'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { PublicAggregateLivestream } from '@rebel/api-models/public/livestream/PublicAggregateLivestream'
import { getLivestreamLink } from '@rebel/shared/util/text'
import AggregateLivestream from '@rebel/server/models/AggregateLivestream'

export function youtubeLivestreamToPublic (livestream: YoutubeLivestream): PublicLivestream {
  const link = getLivestreamLink(livestream.liveId)

  let status: PublicLivestream['status']
  if (livestream.start == null) {
    status = 'not_started'
  } else if (livestream.end == null) {
    status = 'live'
  } else {
    status = 'finished'
  }

  return {
    id: livestream.id,
    platform: 'youtube',
    livestreamLink: link,
    status,
    startTime: livestream.start?.getTime() ?? null,
    endTime: livestream.end?.getTime() ?? null
  }
}

export function twitchLivestreamToPublic (livestream: TwitchLivestream, twitchChannelName: string): PublicLivestream {
  let status: PublicLivestream['status']
  if (livestream == null) {
    status = 'not_started'
  } else if (livestream.end == null) {
    status = 'live'
  } else {
    status = 'finished'
  }

  return {
    id: livestream.id,
    platform: 'youtube',
    livestreamLink: `twitch.tv/${twitchChannelName}`,
    status: status,
    startTime: livestream.start?.getTime() ?? null,
    endTime: livestream.end?.getTime() ?? null
  }
}

export function aggregateLivestreamToPublic (aggregateLivestream: AggregateLivestream, twitchChannelName: string | null): PublicAggregateLivestream {
  if (twitchChannelName == null && aggregateLivestream.getTwitchLivestreams().length > 0) {
    throw new Error('Unable to convert AggregateLivestream to a public object because it contains Twitch livestreams, but no twitch channel name was provided')
  }

  return {
    startTime: aggregateLivestream.startTime.getTime(),
    endTime: aggregateLivestream.endTime?.getTime() ?? null,
    livestreams: aggregateLivestream.livestreams.map(livestream =>
      isYoutubeLivestream(livestream) ? youtubeLivestreamToPublic(livestream) : twitchLivestreamToPublic(livestream, twitchChannelName!)
    )
  }
}

export function isTwitchLivestream (livestream: YoutubeLivestream | TwitchLivestream): livestream is TwitchLivestream {
  return !('liveId' in livestream)
}

export function isYoutubeLivestream (livestream: YoutubeLivestream | TwitchLivestream): livestream is YoutubeLivestream {
  return 'liveId' in livestream
}
