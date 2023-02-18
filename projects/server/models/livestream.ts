import { Livestream } from '@prisma/client'
import { LiveStatus } from '@rebel/masterchat'
import { PublicLivestream } from '@rebel/server/controllers/public/livestream/PublicLivestream'
import { getLivestreamLink } from '@rebel/shared/util/text'

export function livestreamToPublic (livestream: Livestream): PublicLivestream {
  const link = getLivestreamLink(livestream.liveId)

  let status: Exclude<LiveStatus, 'unknown'>
  if (livestream.start == null) {
    status = 'not_started'
  } else if (livestream.end == null) {
    status = 'live'
  } else {
    status = 'finished'
  }

  return {
    id: livestream.id,
    livestreamLink: link,
    status,
    startTime: livestream.start?.getTime() ?? null,
    endTime: livestream.end?.getTime() ?? null
  }
}
