import { PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'
import { assertUnreachable } from '@rebel/shared/util/typescript'

export function getChannelUrl (channel: Pick<PublicChannel, 'platform' | 'externalIdOrUserName'>) {
  if (channel.platform === 'youtube') {
    return `https://www.youtube.com/channel/${channel.externalIdOrUserName}`
  } else if (channel.platform === 'twitch') {
    return `https://www.twitch.tv/${channel.externalIdOrUserName}`
  } else {
    assertUnreachable(channel.platform)
  }
}
