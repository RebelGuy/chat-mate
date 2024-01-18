import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'

export function isLivestreamLive (livestream: PublicLivestream | null): boolean {
  return livestream != null && livestream.status === 'live'
}

export function isStreamerLive (streamer: PublicStreamerSummary): boolean {
  return isLivestreamLive(streamer.currentYoutubeLivestream) || isLivestreamLive(streamer.currentTwitchLivestream)
}

// Twitch and Youtube streamer auth both use the /manager page.
// upon redirect, we are provided with a code that we must relay to the Server.
// this is kind of a hack, but one way to distinguish the two auth types is by checking the scope
export function getAuthTypeFromParams (params: URLSearchParams): 'youtube' | 'twitch' | undefined {
  if (!params.has('code') || !params.has('scope')) {
    return undefined
  }

  const scope = params.get('scope')!
  if (scope.includes('moderator:read:followers')) {
    return 'twitch'
  } else {
    return 'youtube'
  }
}
