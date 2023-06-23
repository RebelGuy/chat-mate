import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'

export function isLive (livestream: PublicLivestream | null): boolean {
  return livestream != null && livestream.status === 'live'
}
