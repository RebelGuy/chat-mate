import { PublicObject } from '@rebel/api-models/types'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'

export type PublicNewViewerData = PublicObject<{
  /** The user that is the new viewer. */
  user: PublicUser
}>
