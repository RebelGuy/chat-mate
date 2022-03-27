import { ChannelInfo, ChatMessage, ChatUser, Livestream, TwitchChannelInfo } from '@prisma/client'
import { Author, ChatItem, TwitchAuthor } from '@rebel/server/models/chat'
import { Db } from '@rebel/server/providers/DbProvider'
import { ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import { addTime } from '@rebel/server/util/datetime'

export const time1 = new Date(2022, 0, 3)
export const time2 = new Date(2022, 0, 4)
export const time3 = new Date(2022, 0, 5)

export const livestream1: Livestream = {
  id: 1,
  liveId: 'liveId1',
  continuationToken: 'token1',
  createdAt: time1,
  start: time1,
  end: addTime(time1, 'seconds', 1)
}
export const livestream2: Livestream = {
  id: 2,
  liveId: 'liveId2',
  continuationToken: null,
  createdAt: time2,
  start: time2,
  end: addTime(time2, 'seconds', 1)
}
export const livestream3: Livestream = {
  id: 3,
  liveId: 'liveId3',
  continuationToken: 'token3',
  createdAt: time3,
  start: time3,
  end: null
}

export const user1: ChatUser = { id: 1 }
export const user2: ChatUser = { id: 2 }
export const user3: ChatUser = { id: 3 }

export const channel1 = 'channel1'
export const author1: Author = {
  attributes: { isModerator: true, isOwner: false, isVerified: false },
  channelId: channel1,
  image: 'author1.image',
  name: 'author1.name'
}
export const channelInfo1: Omit<ChannelInfo, 'id' | 'channelId'> = {
  isModerator: author1.attributes.isModerator,
  isOwner: author1.attributes.isOwner,
  IsVerified: author1.attributes.isVerified,
  imageUrl: author1.image,
  name: author1.name!,
  time: time1
}

export const channel2 = 'channel2'
export const author2: Author = {
  attributes: { isModerator: false, isOwner: false, isVerified: true },
  channelId: channel2,
  image: 'author2.image',
  name: 'author2.name'
}
export const channelInfo2: Omit<ChannelInfo, 'id' | 'channelId'> = {
  isModerator: author2.attributes.isModerator,
  isOwner: author2.attributes.isOwner,
  IsVerified: author2.attributes.isVerified,
  imageUrl: author2.image,
  name: author2.name!,
  time: time1
}

export const twitchChannel3 = 'twitchChannel3'
export const author3: TwitchAuthor = {
  userName: 'some_twitch_userName',
  displayName: 'Twitch User',
  color: '#00000',
  userId: '12345',
  userType: 'mod',
  isBroadcaster: false,
  isMod: true,
  isSubscriber: false,
  isVip: false,
  badges: new Map(),
  badgeInfo: new Map()
}
export const twitchChannelInfo3: Omit<TwitchChannelInfo, 'id' | 'channelId'> = {
  userName: author3.userName,
  displayName: author3.displayName,
  colour: author3.color!,
  time: time1,
  isBroadcaster: author3.isBroadcaster,
  isMod: author3.isMod,
  isSubscriber: author3.isSubscriber,
  isVip: author3.isVip,
  userType: author3.userType!
}

export const twitchChannel4 = 'twitchChannel4'

/** By youtube channel1 at time1 with empty message */
export const chatItem1: ChatItem = {
  id: 'chat_id1',
  platform: 'youtube',
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
export function addChatMessage (db: Db, time: Date, livestreamId: number, userId: number, youtubeChannelId: number): Promise<ChatMessage> {
  return db.chatMessage.create({ data: {
    time,
    youtubeId: 'testMessage-' + Math.random(),
    user: { connect: { id: userId }},
    channel: { connect: { id: youtubeChannelId }},
    livestream: { connect: { id: livestreamId }},
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
