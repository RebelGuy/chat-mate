import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicStreamerSummary = PublicObject<{
  /** The streamer's registered username on ChatMate. */
  username: string

  /** Whether a livestream is currently in progress. */
  isLive: boolean
}>
