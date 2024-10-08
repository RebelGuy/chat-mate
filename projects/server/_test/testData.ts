import { YoutubeChannelGlobalInfo, ChatMessage, TwitchChannelGlobalInfo, YoutubeLivestream } from '@prisma/client'
import { Author, ChatItem, TwitchAuthor } from '@rebel/server/models/chat'
import { Db } from '@rebel/server/providers/DbProvider'
import { ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import { SafeOmit } from '@rebel/shared/types'
import { addTime } from '@rebel/shared/util/datetime'

export const time1 = new Date(2022, 0, 3)
export const time2 = new Date(2022, 0, 4)
export const time3 = new Date(2022, 0, 5)
export const time4 = new Date(2022, 0, 6)
export const time5 = new Date(2022, 0, 7)

export const livestream1: YoutubeLivestream = {
  id: 1,
  liveId: 'liveId1',
  streamerId: 1,
  continuationToken: 'token1',
  createdAt: time1,
  start: time1,
  end: addTime(time1, 'seconds', 1),
  isActive: true
}
export const livestream2: YoutubeLivestream = {
  id: 2,
  liveId: 'liveId2',
  streamerId: 1,
  continuationToken: null,
  createdAt: time2,
  start: time2,
  end: addTime(time2, 'seconds', 1),
  isActive: true
}
export const livestream3: YoutubeLivestream = {
  id: 3,
  liveId: 'liveId3',
  streamerId: 1,
  continuationToken: 'token3',
  createdAt: time3,
  start: time3,
  end: null,
  isActive: true
}

export const youtubeChannel1 = 'channel1'
export const author1: Author = {
  attributes: { isModerator: true, isOwner: false, isVerified: false },
  channelId: youtubeChannel1,
  image: 'author1.image',
  name: 'author1.name'
}
export const youtubeChannelGlobalInfo1: SafeOmit<YoutubeChannelGlobalInfo, 'id' | 'channelId' | 'imageId'> = {
  isVerified: author1.attributes.isVerified,
  imageUrl: author1.image,
  name: author1.name!,
  time: time1
}

export const youtubeChannel2 = 'channel2'
export const author2: Author = {
  attributes: { isModerator: false, isOwner: false, isVerified: true },
  channelId: youtubeChannel2,
  image: 'author2.image',
  name: 'author2.name'
}

export const twitchChannel3 = 'twitchChannel3'
export const author3: TwitchAuthor = {
  userName: 'some_twitch_userName',
  displayName: 'Twitch User',
  color: '#00000',
  userId: twitchChannel3,
  userType: 'mod',
  isBroadcaster: false,
  isMod: true,
  isSubscriber: false,
  isVip: false,
  badges: new Map(),
  badgeInfo: new Map()
}
export const twitchChannelGlobalInfo3: SafeOmit<TwitchChannelGlobalInfo, 'id' | 'channelId'> = {
  userName: author3.userName,
  displayName: author3.displayName,
  colour: author3.color!,
  time: time1,
  userType: author3.userType!
}

export const twitchChannel4 = 'twitchChannel4'

/** By youtube channel1 at time1 with empty message */
export const chatItem1: ChatItem = {
  id: 'chat_id1',
  platform: 'youtube',
  contextToken: 'params1',
  author: author1,
  timestamp: time1.getTime(),
  messageParts: []
}

export const chatExperienceData1: ChatExperienceData = {
  baseExperience: 1000,
  externalId: 'chat id 1',
  participationStreakMultiplier: 1.2,
  viewershipStreakMultiplier: 1.5,
  spamMultiplier: 0.99995,
  messageQualityMultiplier: 0.5,
  repetitionPenalty: 0
}
export const chatExperienceData2: ChatExperienceData = {
  baseExperience: 1000,
  externalId: 'chat id 2',
  participationStreakMultiplier: 1.5,
  viewershipStreakMultiplier: 1.2,
  spamMultiplier: 0.1,
  messageQualityMultiplier: 0.1,
  repetitionPenalty: -0.2
}
export const chatExperienceData3: ChatExperienceData = {
  baseExperience: 1000,
  externalId: 'chat id 3',
  participationStreakMultiplier: 1.01,
  viewershipStreakMultiplier: 1,
  spamMultiplier: 1,
  messageQualityMultiplier: 0.2,
  repetitionPenalty: 0
}

/** Adds random data. Assumes the user, channel and livestream have already been created. */
export function addChatMessage (db: Db, time: Date, streamerId: number, youtubeLivestreamId: number | null, userId: number, youtubeChannelId: number): Promise<ChatMessage> {
  return db.chatMessage.create({ data: {
    time,
    streamer: { connect: { id: streamerId }},
    externalId: 'testMessage-' + Math.random(),
    user: { connect: { id: userId }},
    youtubeChannel: { connect: { id: youtubeChannelId }},
    youtubeLivestream: youtubeLivestreamId == null ? undefined : { connect: { id: youtubeLivestreamId }},
    chatMessageParts: { create: {
      order: 0,
      text: { create: {
        isBold: false,
        isItalics: false,
        text: 'random message ' + Math.random()
      }}
    }}
  }})
}
