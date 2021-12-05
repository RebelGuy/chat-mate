// tslint:disable-next-line:no-var-requires
require('module-alias/register')
import express from "express"
import { Server } from "typescript-rest"
import { ChatController } from "@rebel/controllers/ChatController"
import env from "./globals"
import { ContextProvider, setContextProvider } from '@rebel/context/ContextProvider'
import ChatService from '@rebel/services/ChatService'
import ServiceFactory from '@rebel/context/ServiceFactory'
import ChatStore from '@rebel/stores/ChatStore'
import MasterchatFactory from '@rebel/factories/MasterchatFactory'
import path from 'node:path'
import FileService from '@rebel/services/FileService'
import { getLiveId } from '@rebel/util'

const port = env('port')
const globalContext = ContextProvider.create()
  .withProperty('port', port)
  .withProperty('auth', env('auth'))
  .withProperty('channelId', env('channelId'))
  .withProperty('liveId', getLiveId(env('liveId')))
  .withProperty('dataPath', path.resolve(__dirname, `../data/${env('nodeEnv')}/`))
  .withClass(FileService)
  .withClass(MasterchatFactory)
  .withClass(ChatStore)
  .withClass(ChatService)
  .build()


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
  console.log(`Server is listening on ${port}`)
})
