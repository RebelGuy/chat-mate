require('./_config')
import express from 'express'
import { Server } from 'typescript-rest'
import { ChatController } from '@rebel/server/controllers/ChatController'
import env from './globals'
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
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import ChatMateController from '@rebel/server/controllers/ChatMateController'
import StatusService from '@rebel/server/services/StatusService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'

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
  .withHelpers('timerHelpers', TimerHelpers)
  .withClass('fileService', FileService)
  .withClass('logService', LogService)
  .withClass('statusService', StatusService)
  .withClass('dbProvider', DbProvider)
  .withClass('masterchatProvider', MasterchatProvider)
  .withClass('masterchatProxyService', MasterchatProxyService)
  .withClass('livestreamStore', LivestreamStore)
  .withClass('viewershipStore', ViewershipStore)
  .withClass('livestreamService', LivestreamService)
  .withClass('experienceStore', ExperienceStore)
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
    .withClass('chatMateController', ChatMateController)
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
  ChatMateController,
  ChatController,
)

const dbProvider = globalContext.getClassInstance('dbProvider')
const livestreamStore = globalContext.getClassInstance('livestreamStore')
const livestreamService = globalContext.getClassInstance('livestreamService')
const chatService = globalContext.getClassInstance('chatService')

// eslint-disable-next-line @typescript-eslint/no-floating-promises
livestreamStore.createLivestream().then(async () => {
  await dbProvider.start()
  await livestreamService.start()
  await chatService.start()

  // start
  app.listen(port, () => {
    logContext.logInfo(`Server is listening on ${port}`)
  })
})
