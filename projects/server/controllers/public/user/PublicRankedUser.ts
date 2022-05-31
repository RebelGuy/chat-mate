import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicRankedUser = PublicObject<2, {
  schema: 2

  /** The rank of the user, where 1 is the highest (best) rank. Integer value. */
  rank: number

  /** The user that holds this rank. */
  user: Tagged<2, PublicUser>
}>
