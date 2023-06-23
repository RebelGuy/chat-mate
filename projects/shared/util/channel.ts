import { assertUnreachable } from '@rebel/shared/util/typescript'

export function getChannelUrlFromPublic (channel: { platform: 'youtube' | 'twitch', externalIdOrUserName: string }) {
  if (channel.platform === 'youtube') {
    return `https://www.youtube.com/channel/${channel.externalIdOrUserName}`
  } else if (channel.platform === 'twitch') {
    return `https://www.twitch.tv/${channel.externalIdOrUserName}`
  } else {
    assertUnreachable(channel.platform)
  }
}
