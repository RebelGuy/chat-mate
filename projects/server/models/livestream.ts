import { YoutubeLivestream, TwitchLivestream } from '@prisma/client'
import { LiveStatus } from '@rebel/masterchat'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { getLivestreamLink } from '@rebel/shared/util/text'

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

export function isTwitchLivestream (livestream: YoutubeLivestream | TwitchLivestream): livestream is TwitchLivestream {
  return !('liveId' in livestream)
}

export function isYoutubeLivestream (livestream: YoutubeLivestream | TwitchLivestream): livestream is YoutubeLivestream {
  return 'liveId' in livestream
}
