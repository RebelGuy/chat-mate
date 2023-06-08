import { PublicObject } from '@rebel/api-models/types'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'

/** Represents a channel to which a rank change has been made. Note that this does not necessarily mean that the state of the external channel actually changed, just that a change was requested and accepted. */
export type PublicChannelRankChange = PublicObject<{
  /** The channel to which a rank change has been made. */
  channel: PublicChannel

  /** The error that was incurred as a result of attempting to update the rank externally. `null` if the rank was updated successfully. */
  error: string | null
}>
