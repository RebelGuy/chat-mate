import { PublicPlatformRank } from '@rebel/api-models/public/event/PublicPlatformRank'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { PublicObject } from '@rebel/api-models/types'
import { SafeExtract } from '@rebel/shared/types'

export type PublicRankUpdateData = PublicObject<{
  /** The rank type that this update represents. */
  rankName: SafeExtract<PublicRank['name'], 'mod' | 'mute' | 'timeout' | 'ban'>

  /** Whether the rank was added to or removed from the user. */
  isAdded: boolean

  /** The user that applied the rank update, if known. */
  appliedBy: PublicUser | null

  /** The user that was affected by this rank update. */
  user: PublicUser

  /** Details about the rank updates on the user's linked external platforms. */
  platformRanks: PublicPlatformRank[]
}>
