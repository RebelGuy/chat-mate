import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicChannelInfo = PublicObject<1, {
  schema: 1

  /** The name of the YouTube channel. */
  channelName: string
}>
