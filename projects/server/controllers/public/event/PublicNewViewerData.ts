import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export type PublicNewViewerData = PublicObject<{
  /** The user that is the new viewer. */
  user: PublicUser
}>
