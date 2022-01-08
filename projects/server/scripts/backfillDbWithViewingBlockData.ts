require('module-alias/register')
import { Livestream, Prisma, PrismaClient } from '@prisma/client'
import { ContextProvider } from '@rebel/server/context/context'
import env from '@rebel/server/globals'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import { DATABASE_URL, DATA_PATH, DB_NAME, IS_LIVE } from '@rebel/server/scripts/consts'
import FileService from '@rebel/server/services/FileService'
import LogService from '@rebel/server/services/LogService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER, VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE } from '@rebel/server/stores/ViewershipStore'
import { addTime } from '@rebel/server/util/datetime'

// CHAT-103
// run using
//   yarn workspace server cross-env NODE_ENV=debug BUILD=tsc dotenv -e debug.env node ../../dist/debug/server/scripts/backfillDbWithViewingBlockData.js --inspect

type ViewingBlock = {
  channelId: number
  startTime: Date
  lastUpdate: Date
}

const main = async () => {
  const client = new PrismaClient()
  const liveIds = await client.$queryRaw<Livestream[]>`SELECT * FROM livestream`

  for (const livestream of liveIds) {
    const context = ContextProvider.create()
      .withProperty('isLive', IS_LIVE)
      .withProperty('liveId', livestream.liveId)
      .withProperty('dataPath', DATA_PATH)
      .withProperty('databaseUrl', DATABASE_URL)
      .withProperty('auth', env('auth'))
      .withProperty('isMockLivestream', env('isMockLivestream'))
      .withProperty('channelId', env('channelId'))
      .withClass('fileService', FileService)
      .withClass('logService', LogService)
      .withClass('dbProvider', DbProvider)
      .withClass('masterchatProvider', MasterchatProvider)
      .withClass('livestreamStore', LivestreamStore)
      .withClass('channelStore', ChannelStore)
      .withClass('chatStore', ChatStore)
      .build()

    const db = context.getClassInstance('dbProvider').get()
    const livestreamStore = context.getClassInstance('livestreamStore')
    await livestreamStore.createLivestream()
    const chatStore = context.getClassInstance('chatStore')
    const allChat = await chatStore.getChatSince(0)

    const completedViewingBlocks: ViewingBlock[] = []
    const currentViewingBlocks: Map<number, { startTime: Date, lastUpdate: Date }> = new Map()
    for (const msg of allChat) {
      const startTime = addTime(msg.time, 'minutes', -VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE)
      const lastUpdate = addTime(msg.time, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER)

      const existingBlock = currentViewingBlocks.get(msg.channelId)
      if (existingBlock) {
        if (existingBlock.lastUpdate < startTime) {
          // close off block and add new block
          completedViewingBlocks.push({ ...existingBlock, channelId: msg.channelId })
          currentViewingBlocks.set(msg.channelId, { startTime, lastUpdate })
        } else {
          // extend block
          currentViewingBlocks.set(msg.channelId, { startTime: existingBlock.startTime, lastUpdate })
        }
      } else {
        // add new block
        currentViewingBlocks.set(msg.channelId, { startTime, lastUpdate })
      }
    }

    // close off any current blocks
    currentViewingBlocks.forEach((block, id) => completedViewingBlocks.push({ ...block, channelId: id }))

    completedViewingBlocks.sort((b1, b2) => b1.startTime.getTime() - b2.startTime.getTime())
    await commitBlocks(db, livestream.id, completedViewingBlocks)
    
    context.dispose()
  }
}

async function commitBlocks (db: Db, livestreamId: number, orderedViewingBlocks: ViewingBlock[]) {
  await db.viewingBlock.createMany({ data: orderedViewingBlocks.map(block => ({
    channelId: block.channelId,
    startTime: block.startTime,
    lastUpdate: block.lastUpdate,
    livestreamId
  }) as Prisma.ViewingBlockCreateManyInput)})
}

main()
