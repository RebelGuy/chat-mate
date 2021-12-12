require('./_config')
import express from "express"
import { Server } from "typescript-rest"
import { ChatController } from "@rebel/controllers/ChatController"
import env from "./globals"
import { ContextProvider, setContextProvider } from '@rebel/context/context'
import ChatService from '@rebel/services/ChatService'
import ServiceFactory from '@rebel/context/CustomServiceFactory'
import ChatStore from '@rebel/stores/ChatStore'
import MasterchatProvider from '@rebel/providers/MasterchatProvider'
import path from 'node:path'
import FileService from '@rebel/services/FileService'
import { getLiveId } from '@rebel/util/text'
import LogService, { createLogContext } from '@rebel/services/LogService'
import DbProvider from '@rebel/providers/DbProvider'
import LivestreamStore from '@rebel/stores/LivestreamStore'
import ChannelStore from '@rebel/stores/ChannelStore'

const port = env('port')
const dataPath = path.resolve(__dirname, `../../data/${env('nodeEnv')}/`)
const liveId = getLiveId(env('liveId'))
const globalContext = ContextProvider.create()
  .withProperty('port', port)
  .withProperty('auth', env('auth'))
  .withProperty('channelId', env('channelId'))
  .withProperty('liveId', liveId)
  .withProperty('dataPath', dataPath)
  .withProperty('isMockLivestream', env('isMockLivestream'))
  .withProperty('disableSaving', env('disableSaving') ?? false)
  .withProperty('isLive', env('nodeEnv') === 'release')
  .withProperty('databaseUrl', env('databaseUrl'))
  .withClass(FileService)
  .withClass(LogService)
  .withClass(DbProvider)
  .withClass(LivestreamStore)
  .withClass(ChannelStore)
  .withClass(ChatStore)
  .withClass(MasterchatProvider)
  .withClass(ChatService)
  .build()

const logContext = createLogContext(globalContext.getInstance<LogService>(LogService), { name: 'App' })
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
    .withClass(ChatController)
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

const livestreamStore = globalContext.getInstance<LivestreamStore>(LivestreamStore)
const chatService = globalContext.getInstance<ChatService>(ChatService)

livestreamStore.createLivestream().then(() => chatService.start())
