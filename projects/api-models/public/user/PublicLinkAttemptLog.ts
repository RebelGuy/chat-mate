import { PublicLinkAttemptStep } from '@rebel/api-models/public/user/PublicLinkAttemptStep'
import { PublicObject } from '@rebel/api-models/types'

export type PublicLinkAttemptLog = PublicObject<{
  /** The internal id of the link attempt. */
  id: number

  /** The time at which the link attempt was started. */
  startTime: number

  /** The time at which the link attempt completed or failed. Null if the link attempt is still in progress. */
  endTime: number | null

  /** The error message encountered. Null if the link attempt is still in progres or completed successfully. */
  errorMessage: string | null

  /** The default user that is being linked in this link attempt. */
  defaultChatUserId: number

  /** The aggregate user that the default user attempted linked to. */
  aggregateChatUserId: number

  /** The list of steps executed as part of the link attempt. */
  steps: PublicLinkAttemptStep[]

  /** The type of link attempt. */
  type: 'link' | 'unlink'

  /** Values of null indicate that the link attempt was initiated by an admin. */
  linkToken: string | null

  /** Whether the link attempt lock is released, allowing new link attempts to be initiated. If false, no new link attempts can be created. */
  released: boolean
}>
