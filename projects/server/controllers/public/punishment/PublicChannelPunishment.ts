import { PublicObject } from '@rebel/server/controllers/ControllerBase'

/** Represents the result of applying a punishment to the channel on the external platform. */
export type PublicChannelPunishment = PublicObject<1, {
  schema: 1,

  /** The internal ID of the YouTube or Twitch channel. */
  channelId: number

  /** The platform on which the channel resides. */
  platform: 'youtube' | 'twitch'

  /** The current name of the channel. */
  channelName: string

  /** The error that was incurred as a result of attempting to apply the punishment externally. `null` if the punishment was applied successfully. */
  error: string | null
}>
