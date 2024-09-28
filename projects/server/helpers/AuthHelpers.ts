import { YOUTUBE_ADMIN_SCOPE, YOUTUBE_STREAMER_SCOPE, YOUTUBE_USER_SCOPE } from '@rebel/server/constants'
import ContextClass from '@rebel/shared/context/ContextClass'
import { compareArrays } from '@rebel/shared/util/arrays'
import { assertUnreachable } from '@rebel/shared/util/typescript'

export type YoutubeAuthType =
  // for the ChatMate admin youtube channel
  'admin' |

  // for streamers to allow ChatMate to send requests on their behalf
  'streamer' |

  // for anyone to prove they own a channel when linking a channel (may or may not have been seen before on ChatMate)
  'user'

export default class AuthHelpers extends ContextClass {
  getYoutubeScope (scopeType: YoutubeAuthType) {
    if (scopeType === 'admin') {
      return YOUTUBE_ADMIN_SCOPE
    } else if (scopeType === 'streamer') {
      return YOUTUBE_STREAMER_SCOPE
    } else if (scopeType === 'user') {
      return YOUTUBE_USER_SCOPE
    } else {
      assertUnreachable(scopeType)
    }
  }

  compareYoutubeScopes (expectedScopeType: YoutubeAuthType, actualScopes: string[]): boolean {
    const expected = this.getYoutubeScope(expectedScopeType)
    return compareArrays([...expected].sort(), [...actualScopes].sort())
  }
}
