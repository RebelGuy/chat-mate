require('./_config')
import express from "express"
import { Server } from "typescript-rest"
import { ChatController } from "@rebel/server/controllers/ChatController"
import env from "./globals"
import { ContextProvider, setContextProvider } from '@rebel/server/context/context'
import ChatService from '@rebel/server/services/ChatService'
import ServiceFactory from '@rebel/server/context/CustomServiceFactory'
import ChatStore from '@rebel/server/stores/ChatStore'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import path from 'node:path'
import FileService from '@rebel/server/services/FileService'
import { getLiveId } from '@rebel/server/util/text'
import LogService, { createLogContext } from '@rebel/server/services/LogService'
import DbProvider from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ExperienceHelpers from '@rebel/server/helpers/ExperienceHelpers'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import LivestreamService from '@rebel/server/services/LivestreamService'

//
// "Over-engineering is the best thing since sliced bread."
//   - some Rebel Guy
//

const port = env('port')
const dataPath = path.resolve(__dirname, `../../../data/${env('nodeEnv')}/`)
const liveId = getLiveId(env('liveId'))
const globalContext = ContextProvider.create()
  .withProperty('port', port)
  .withProperty('auth', env('auth'))
  .withProperty('channelId', env('channelId'))
  .withProperty('liveId', liveId)
  .withProperty('dataPath', dataPath)
  .withProperty('isMockLivestream', env('isMockLivestream'))
  .withProperty('isLive', env('nodeEnv') === 'release')
  .withProperty('databaseUrl', env('databaseUrl'))
  .withHelpers('experienceHelpers', ExperienceHelpers)
  .withClass('fileService', FileService)
  .withClass('logService', LogService)
  .withClass('dbProvider', DbProvider)
  .withClass('masterchatProvider', MasterchatProvider)
  .withClass('livestreamStore', LivestreamStore)
  .withClass('livestreamService', LivestreamService)
  .withClass('experienceStore', ExperienceStore)
  .withClass('viewershipStore', ViewershipStore)
  .withClass('experienceService', ExperienceService)
  .withClass('channelStore', ChannelStore)
  .withClass('chatStore', ChatStore)
  .withClass('chatService', ChatService)
  .build()

const logContext = createLogContext(globalContext.getClassInstance('logService'), { name: 'App' })
logContext.logInfo(`Using live ID ${liveId}`)

const app = express()
// this is middleware - we can supply an ordered collection of such functions,
// and they will run in order to do common operations on the request before it
// reaches the controllers.
app.use((req, res, next) => {
  // todo: do auth here, and fail if not authorised

  // go to the next handler
  next()
})

app.use((req, res, next) => {
  const context = globalContext.asParent()
    .withClass('chatController', ChatController)
    .build()
  setContextProvider(req, context)
  next()
})

// for each request, the Server will instantiate a new instance of each Controller.
// since we want to inject dependencies, we need to provide a custom implementation.
Server.registerServiceFactory(new ServiceFactory())

// tells the server which classes to use as Controllers
Server.buildServices(app,
  ChatController,
)

// start
app.listen(port, () => {
  logContext.logInfo(`Server is listening on ${port}`)
})

const livestreamStore = globalContext.getClassInstance('livestreamStore')
const livestreamService = globalContext.getClassInstance('livestreamService')
const chatService = globalContext.getClassInstance('chatService')

livestreamStore.createLivestream().then(async () => {
  await livestreamService.start()
  await chatService.start()
})
