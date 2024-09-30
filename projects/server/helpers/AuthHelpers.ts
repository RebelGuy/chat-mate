import { TWITCH_ADMIN_SCOPE, TWITCH_STREAMER_SCOPE, TWITCH_USER_SCOPE, YOUTUBE_ADMIN_SCOPE, YOUTUBE_STREAMER_SCOPE, YOUTUBE_USER_SCOPE } from '@rebel/server/constants'
import ContextClass from '@rebel/shared/context/ContextClass'
import { compareArrays } from '@rebel/shared/util/arrays'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { revokeToken } from '@twurple/auth'

export type YoutubeAuthType =
  // for the ChatMate admin youtube channel
  'admin' |

  // for streamers to allow ChatMate to send requests on their behalf
  'streamer' |

  // for anyone to prove they own a channel when linking a channel (may or may not have been seen before on ChatMate)
  'user'

export type TwitchAuthType = 'admin' | 'streamer' | 'user'

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

  getTwitchScope (scopeType: TwitchAuthType) {
    if (scopeType === 'admin') {
      return TWITCH_ADMIN_SCOPE
    } else if (scopeType === 'streamer') {
      return TWITCH_STREAMER_SCOPE
    } else if (scopeType === 'user') {
      return TWITCH_USER_SCOPE
    } else {
      assertUnreachable(scopeType)
    }
  }

  compareTwitchScopes (expectedScopeType: TwitchAuthType, actualScopes: string[]): boolean {
    const expected = this.getTwitchScope(expectedScopeType)
    return compareArrays([...expected].sort(), [...actualScopes].sort())
  }

  revokeTwitchAccessToken (clientId: string, accessToken: string) {
    return revokeToken(clientId, accessToken)
  }
}
