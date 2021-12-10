import * as fs from 'fs'
import env from '../globals'
import path from 'node:path'
import { ContextProvider } from '../context/context'
import FileService from '../services/FileService'
import LogService, { createLogContext } from '../services/LogService'
import DbProvider from '../providers/DbProvider'
import { ChatSave } from '../stores/ChatStore'

// run using
//   cross-env NODE_ENV=debug dotenv -e debug.env ts-node src/scripts/migrations/applySchemaMigrations.ts

const main = async () => {
    const dataPath = path.resolve(__dirname, `../../data/${env('nodeEnv')}/`)

    const dataFiles = fs.readdirSync(dataPath)
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

      const data: ChatSave = fileService.readObject<ChatSave>(filePath)

      let livestream = await db.livestream.findUnique({ where: { liveId }})
      break
      // livestream = await db.livestream.create({ data: {
      //   liveId,
      //   continuationToken: data.continuationToken,
      //   createdAt: fs.statSync(filePath).birthtime
      // }})

      console.log(`Completed liveId ${liveId} successfully\n\n`)
    }

    console.log(`The script ran to completion`)
    process.exit(0)
}

main()