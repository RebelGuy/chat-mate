import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicRankedUser = PublicObject<{
  /** The rank of the user, where 1 is the highest (best) rank. Integer value. */
  rank: number

  /** The user that holds this rank. */
  user: PublicObject<PublicUser>
}>
