import { ChannelInfo, ChatMessage, Livestream } from '@prisma/client'
import { Author } from '@rebel/server/models/chat'
import { Db } from '@rebel/server/providers/DbProvider'
import { ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
``
export const time1 = new Date(2022, 0, 3)
export const time2 = new Date(2022, 0, 4)
export const time3 = new Date(2022, 0, 5)

export const livestream: Livestream = {
  id: 1,
  liveId: 'liveId',
  continuationToken: 'token',
  createdAt: new Date(),
  start: new Date(),
  end: null
}

export const channel1 = 'channel1'
export const channelInfo1: Omit<ChannelInfo, 'id' | 'channelId'> = {
  isModerator: true,
  isOwner: false,
  IsVerified: false,
  imageUrl: 'author1.image',
  name: 'author1.name',
  time: time1
}

export const channel2 = 'channel2'
export const channelInfo2: Omit<ChannelInfo, 'id' | 'channelId'> = {
  isModerator: false,
  isOwner: false,
  IsVerified: true,
  imageUrl: 'author2.image',
  name: 'author2.name',
  time: time1
}

export const chatExperienceData1: ChatExperienceData = {
  baseExperience: 1000,
  chatMessageYtId: 'chat id 1',
  participationStreakMultiplier: 1.2,
  viewershipStreakMultiplier: 1.5,
  spamMultiplier: 0.99995,
  messageQualityMultiplier: 0.5
}
export const chatExperienceData2: ChatExperienceData = {
  baseExperience: 1000,
  chatMessageYtId: 'chat id 2',
  participationStreakMultiplier: 1.5,
  viewershipStreakMultiplier: 1.2,
  spamMultiplier: 0.1,
  messageQualityMultiplier: 0.1
}
export const chatExperienceData3: ChatExperienceData = {
  baseExperience: 1000,
  chatMessageYtId: 'chat id 3',
  participationStreakMultiplier: 1.01,
  viewershipStreakMultiplier: 1,
  spamMultiplier: 1,
  messageQualityMultiplier: 0.2
}

/** Adds random data. Assumes the channel and livestream have already been created. */
export async function addChatMessage (db: Db, time: Date, livestreamId: number, channelId: string): Promise<ChatMessage> {
  return db.chatMessage.create({ data: {
    time,
    youtubeId: 'testMessage-' + Math.random(),
    channel: { connect: { youtubeId: channelId }},
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
