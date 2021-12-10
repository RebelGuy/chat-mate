require('../_config')
import * as fs from 'fs'
import env from '@rebel/globals'
import path from 'node:path'
import { ContextProvider } from '@rebel/context/context'
import FileService from '@rebel/services/FileService'
import LogService, { createLogContext } from '@rebel/services/LogService'
import DbProvider from '@rebel/providers/DbProvider'
import { ChatSave } from '@rebel/stores/ChatStore'
import { Prisma } from '@prisma/client'

// run using
//   yarn cross-env NODE_ENV=debug node --inspect dist/debug/scripts/fillDatabaseWithJsonData.js

const main = async () => {
    const dataPath = path.resolve(__dirname, `../../../data/${env('nodeEnv')}/`)

    const dataFiles = fs.readdirSync(dataPath)
      .sort((a, b) => fs.statSync(path.join(dataPath, a)).birthtimeMs - fs.statSync(path.join(dataPath, b)).birthtimeMs)
    for (const file of dataFiles) {
      if (path.extname(file).toLowerCase() !== '.json' || !file.startsWith('chat_')) {
        continue
      }

      const filePath = path.join(dataPath, file)
      const fileName = path.basename(file, '.json') // in the form chat_id.json or chat_time_id.json

      const parts = fileName.split('_')
      let liveId: string
      if (parts.length === 2) {
        // without timestamp
        liveId = parts[1].substring(0, 11)
      } else if (parts.length === 3) {
        // with timestamp
        liveId = parts[2].substring(0, 11)
      } else {
        console.log(`Could not parse liveId for the file ${file}... skipping`)
        continue
      }
      console.log(`Using liveId ${liveId}`)

      const context = ContextProvider.create()
        .withProperty('liveId', liveId)
        .withProperty('dataPath', dataPath)
        .withProperty('disableSaving', false)
        .withProperty('isLive', env('nodeEnv') === 'release')
        .withProperty('databaseUrl', env('databaseUrl'))
        .withClass(FileService)
        .withClass(LogService)
        .withClass(DbProvider)
        .build()

      const logContext = createLogContext(context.getInstance<LogService>(LogService), { name: 'fillDatabaseWithJsonData.ts' })
      const fileService = context.getInstance<FileService>(FileService)
      const db = context.getInstance<DbProvider>(DbProvider).get()

      const data: ChatSave = fileService.readObject<ChatSave>(filePath)!

      // get or create livestream
      let livestream = await db.livestream.findUnique({ where: { liveId }})
      if (!livestream) {
        livestream = await db.livestream.create({ data: {
          liveId,
          continuationToken: data.continuationToken,
          createdAt: fs.statSync(filePath).birthtime
        }})
      }

      for (const { timestamp, id: chatId, author, messageParts } of data.chat) {
        // get/update or create channel
        let channel = await db.channel.findUnique({
          where: { youtubeId: author.channelId },
          include: { infoHistory: { orderBy: { time: 'desc' }, take: 1 } }
        })
        const updatedInfo = {
          time: new Date(timestamp),
          name: author.name!,
          imageUrl: author.image,
          isOwner: author.attributes.isOwner,
          isModerator: author.attributes.isModerator,
          IsVerified: author.attributes.isVerified
        }

        if (channel) {
          if (channel.infoHistory.length !== 1) {
            throw new Error('Expected only the latest channel info')
          }
          // if anything has changed, create a new ChannelInfo object and link it to the channel
          const latestInfo = channel.infoHistory[0]
          if (latestInfo.IsVerified != updatedInfo.IsVerified
            || latestInfo.imageUrl != updatedInfo.imageUrl
            || latestInfo.isModerator != updatedInfo.isModerator
            || latestInfo.isOwner != updatedInfo.isOwner
            || latestInfo.name != updatedInfo.name) {
              console.log(`Updating details for channel ${latestInfo.name}`)
              await db.channel.update({
                where: { youtubeId: author.channelId },
                data: {
                  infoHistory: {
                    create: updatedInfo
                  }
                }  
              })
            }

        } else {
          channel = await db.channel.create({
            data: {
              youtubeId: author.channelId,
              infoHistory: { create: updatedInfo }
            },
            // no need to filter/sort: there is only one info piece at this point anyway
            include: { infoHistory: true }
          })
        }

        // create chat message
        if (await db.chatMessage.findUnique({ where: { youtubeId: chatId }})) {
          continue
        }

        const chatMessage = await db.chatMessage.create({
          data: {
            time: new Date(timestamp),
            youtubeId: chatId,
            channel: { connect: { id: channel.id }},
            livestream: { connect: { id: livestream.id }}
          }
        })

        for (let i = 0; i < messageParts.length; i++) {
          const part = messageParts[i]

          if (part.type === 'emoji') {
            const youtubeId = `Unknown-${part.name ?? part.label}`
            await db.chatMessagePart.create({ data: {
              order: i,
              chatMessage: { connect: { id: chatMessage.id }},
              emoji: { connectOrCreate: {
                create: {
                  youtubeId: youtubeId,
                  imageUrl: part.image.url,
                  imageHeight: part.image.height ?? null,
                  imageWidth: part.image.width ?? null,
                  label: part.label,
                  name: part.name,
                  isCustomEmoji: false
                },
                // this is used to find an existing record to connect to the message part - if none is found, creates a new one (defined above)
                where: { youtubeId: youtubeId }
              }}
            }})

          } else {
            await db.chatMessagePart.create({ data: {
              order: i,
              chatMessage: { connect: { id: chatMessage.id }},
              text: { create: {
                isBold: part.isBold,
                isItalics: part.isItalics,
                text: part.text
              }}
            }})
          }
        }
      }

      console.log(`Completed liveId ${liveId} successfully\n\n`)
    }

    console.log(`The script ran to completion`)
    process.exit(0)
}

main()