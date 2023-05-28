import { PublicLivestream } from '@rebel/server/controllers/public/livestream/PublicLivestream'

export function isLive (livestream: PublicLivestream | null): boolean {
  return livestream != null && livestream.status === 'live'
}
