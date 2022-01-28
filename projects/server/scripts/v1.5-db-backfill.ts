require('module-alias/register')
import { Livestream, PrismaClient } from '@prisma/client'
import { ChatResponse, Metadata } from '@rebel/masterchat'
import { ContextProvider } from '@rebel/server/context/context'
import env from '@rebel/server/globals'
import ExperienceHelpers from '@rebel/server/helpers/ExperienceHelpers'
import { IMasterchat } from '@rebel/server/interfaces'
import { Author, ChatItem, ChatItemWithRelations, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import DbProvider from '@rebel/server/providers/DbProvider'
import IProvider from '@rebel/server/providers/IProvider'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import { DATABASE_URL, DATA_PATH, IS_LIVE } from '@rebel/server/scripts/consts'
import ExperienceService from '@rebel/server/services/ExperienceService'
import FileService from '@rebel/server/services/FileService'
import LogService from '@rebel/server/services/LogService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { addTime } from '@rebel/server/util/datetime'

// ************************************
// ************ DEPRECATED ************
// ************************************

// CHAT-110, CHAT-103, CHAT-107
// run using
//   yarn workspace server cross-env NODE_ENV=debug BUILD=tsc dotenv -e debug.env node ../../dist/debug/server/scripts/v1.5-db-backfill.js --inspect

const main = async () => {
  const client = new PrismaClient()
  const livestreams = await client.$queryRaw<Livestream[]>`SELECT * FROM livestream`

  for (const livestream of livestreams) {
    // CHAT-110: Backfill livestream start/end times
    // we pick the time of the 10th and 10th-till-last messages, and pad them with 2 minutes
    // that should be a pretty good guess
    console.log(`Backfilling the livestream metadata for ${livestream.liveId}`)

    const context = await createContext(livestream.liveId)
    const db = context.getClassInstance('dbProvider').get()
    const allChat = await context.getClassInstance('chatStore').getChatSince(0)

    const start = addTime(allChat[9].time, 'minutes', -2)
    const end = addTime(allChat[allChat.length - 10].time, 'minutes', 2)
    await db.livestream.update({
      where: { liveId: livestream.liveId },
      data: { start, end }
    })

    await context.dispose()
  }

  for (const livestream of livestreams) {
    // CHAT-103: Backfill the viewer list
    // go through each message and pretend it is happening in real time - all the
    // required logic already exists in the ViewershipStore
    console.log(`Backfilling the viewing blocks for ${livestream.liveId}`)

    const context = await createContext(livestream.liveId)
    const allChat = await context.getClassInstance('chatStore').getChatSince(0)
    const viewershipStore = context.getClassInstance('viewershipStore')

    for (const chat of allChat) {
      await viewershipStore.addViewershipForChatParticipation(chat.channel.youtubeId, chat.time.getTime())
    }

    // CHAT-107 Backfill chat experience
    // there is a small issue where streak calculations take the data of all, even future, livestreams into account
    // but since there are not many streams yet, it is not a very big issue so we will just leave it.
    console.log(`Backfilling the chat experience for ${livestream.liveId}`)

    const experienceService = context.getClassInstance('experienceService')
    const allMasterchatChat = allChat.map(c => dbToMasterchatChatItem(c))
    await experienceService.addExperienceForChat(allMasterchatChat as any)

    context.dispose()
  }

  console.log('SUCCESS')
}

async function createContext (liveId: string) {
  // extremely hacky: inject the masterchat provider so the LivestreamStore
  // doesn't do anything funny while we fill the db
  class MockMasterchatProvider implements IProvider<IMasterchat> {
    get (): IMasterchat {
      return {
        fetch: () => Promise.resolve({} as ChatResponse),
        fetchMetadata: () => Promise.resolve({ liveStatus: 'finished' } as Metadata)
      }
    }
  }

  const context = ContextProvider.create()
      .withProperty('isLive', IS_LIVE)
      .withProperty('liveId', liveId)
      .withProperty('dataPath', DATA_PATH)
      .withProperty('databaseUrl', DATABASE_URL)
      .withProperty('auth', env('auth'))
      .withProperty('isMockLivestream', env('isMockLivestream'))
      .withProperty('channelId', env('channelId'))
      .withClass('fileService', FileService)
      .withClass('logService', LogService)
      .withClass('dbProvider', DbProvider)
      .withClass('masterchatProvider', MockMasterchatProvider as any as typeof MasterchatProvider) //  :  -  )
      .withClass('livestreamStore', LivestreamStore)
      .withClass('channelStore', ChannelStore)
      .withClass('chatStore', ChatStore)
      .withClass('viewershipStore', ViewershipStore)
      .withClass('experienceStore', ExperienceStore)
      .withHelpers('experienceHelpers', ExperienceHelpers)
      .withClass('experienceService', ExperienceService)
      .build()

  const livestreamStore = context.getClassInstance('livestreamStore')
  await livestreamStore.createLivestream()

  return context
}

function dbToMasterchatChatItem (chat: ChatItemWithRelations): Partial<ChatItem> {
  // we only need the following properties for ViewershipService:
  // timestamp, author.channelId, id [youtubeId]
  // and the following for the ExperienceHelpers:
  // messageParts
  //  - for emojis: unique name per emoji
  //  - for text: the `text` property
  const msgParts = chat.chatMessageParts.sort((part1, part2) => part1.order - part2.order)

  return {
    timestamp: chat.time.getTime(),
    id: chat.youtubeId,
    author: { channelId: chat.channel.youtubeId },
    messageParts: msgParts.map(part => {
      if (part.text != null) {
        return {
          type: 'text',
          text: part.text.text
        } as Partial<PartialTextChatMessage>
      } else if (part.emoji != null) {
        return {
          type: 'emoji',
          name: `${part.emojiId}`
        } as Partial<PartialEmojiChatMessage>
      } else {
        throw new Error('LOL')
      }
    })
  } as Partial<ChatItem>
}

main()
