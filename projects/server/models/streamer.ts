import { PublicStreamerApplication } from '@rebel/api-models/public/user/PublicStreamerApplication'
import { StreamerApplicationWithUser } from '@rebel/server/stores/StreamerStore'

export function streamerApplicationToPublicObject (application: StreamerApplicationWithUser): PublicStreamerApplication {
  let status: PublicStreamerApplication['status']
  if (application.timeClosed == null) {
    status = 'pending'
  } else if (application.isApproved == null) {
    status = 'withdrawn'
  } else {
    status = application.isApproved ? 'approved' : 'rejected'
  }

  return {
    id: application.id,
    username: application.registeredUser.username,
    message: application.message,
    timeCreated: application.timeCreated.getTime(),
    closeMessage: application.closeMessage,
    timeClosed: application.timeClosed?.getTime() ?? null,
    status: status
  }
}
