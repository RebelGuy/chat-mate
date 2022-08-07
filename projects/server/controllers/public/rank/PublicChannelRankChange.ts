import { PublicObject } from '@rebel/server/controllers/ControllerBase'

/** Represents a channel to which a rank change has been made. Note that this does not necessarily mean that the state of the external channel actually changed, just that a change was requested and accepted. */
export type PublicChannelRankChange = PublicObject<1, {
  schema: 1,

  /** The internal ID of the YouTube or Twitch channel. */
  channelId: number

  /** The platform on which the channel resides. */
  platform: 'youtube' | 'twitch'

  /** The current name of the channel. */
  channelName: string

  /** The error that was incurred as a result of attempting to update the rank externally. `null` if the rank was updated successfully. */
  error: string | null
}>
