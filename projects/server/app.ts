require('./_config')
import 'source-map-support/register' // so our stack traces are converted to the typescript equivalent files/lines
import express from 'express'
import { Server } from 'typescript-rest'
import ChatController from '@rebel/server/controllers/ChatController'
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
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceController from '@rebel/server/controllers/ExperienceController'
import UserController from '@rebel/server/controllers/UserController'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import EmojiController from '@rebel/server/controllers/EmojiController'
import cors from 'cors'
import ChatFetchService from '@rebel/server/services/ChatFetchService'
import EmojiService from '@rebel/server/services/EmojiService'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import TwurpleService from '@rebel/server/services/TwurpleService'
import AuthStore from '@rebel/server/stores/AuthStore'
import Factory from '@rebel/server/factories/Factory'
import { RefreshingAuthProvider } from '@twurple/auth/lib'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'

//
// "Over-engineering is the best thing since sliced bread."
//   - some Rebel Guy
//

const port = env('port')
const dataPath = path.resolve(__dirname, `../../../data/${env('nodeEnv')}/`)
const liveId = getLiveId(env('liveId'))
const twitchClientId = env('twitchClientId')
const twitchClientSecret = env('twitchClientSecret')
const twitchChannelName = env('twitchChannelName')
const twitchAccessToken = env('twitchAccessToken')
const twitchRefreshToken = env('twitchRefreshToken')

const globalContext = ContextProvider.create()
  .withProperty('port', port)
  .withProperty('auth', env('auth'))
  .withProperty('channelId', env('channelId'))
  .withProperty('liveId', liveId)
  .withProperty('dataPath', dataPath)
  .withProperty('isMockLivestream', env('isMockLivestream'))
  .withProperty('isLive', env('nodeEnv') === 'release')
  .withProperty('databaseUrl', env('databaseUrl'))
  .withProperty('disableExternalApis', env('useFakeControllers') === true)
  .withProperty('twitchClientId', twitchClientId)
  .withProperty('twitchClientSecret', twitchClientSecret)
  .withProperty('twitchChannelName', twitchChannelName)
  .withProperty('twitchAccessToken', twitchAccessToken)
  .withProperty('twitchRefreshToken', twitchRefreshToken)
  .withHelpers('experienceHelpers', ExperienceHelpers)
  .withHelpers('timerHelpers', TimerHelpers)
  .withFactory('refreshingAuthProviderFactory', RefreshingAuthProviderFactory)
  .withClass('fileService', FileService)
  .withClass('logService', LogService)
  .withClass('masterchatStatusService', StatusService)
  .withClass('twurpleStatusService', StatusService)
  .withClass('dbProvider', DbProvider)
  .withClass('masterchatProvider', MasterchatProvider)
  .withClass('masterchatProxyService', MasterchatProxyService)
  .withClass('authStore', AuthStore)
  .withClass('twurpleAuthProvider', TwurpleAuthProvider)
  .withClass('twurpleChatClientProvider', TwurpleChatClientProvider)
  .withClass('twurpleApiClientProvider', TwurpleApiClientProvider)
  .withClass('twurpleApiProxyService', TwurpleApiProxyService)
  .withClass('livestreamStore', LivestreamStore)
  .withClass('viewershipStore', ViewershipStore)
  .withClass('livestreamService', LivestreamService)
  .withClass('experienceStore', ExperienceStore)
  .withClass('channelStore', ChannelStore)
  .withClass('chatStore', ChatStore)
  .withClass('channelService', ChannelService)
  .withClass('experienceService', ExperienceService)
  .withClass('customEmojiStore', CustomEmojiStore)
  .withClass('emojiService', EmojiService)
  .withClass('chatService', ChatService)
  .withClass('chatFetchService', ChatFetchService)
  .withClass('twurpleService', TwurpleService)
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

// for some reason ChatMate Studio can't POST requests due to some CORS issue. adding this middleware magically fixes it
app.use(cors())

app.use(async (req, res, next) => {
  const context = globalContext.asParent()
    .withClass('chatMateController', ChatMateController)
    .withClass('chatController', ChatController)
    .withClass('emojiController', EmojiController)
    .withClass('experienceController', ExperienceController)
    .withClass('userController', UserController)
    .build()
  await context.initialise()
  setContextProvider(req, context)

  res.on('finish', async () => {
    await context.dispose()
  })

  next()
})

// for each request, the Server will instantiate a new instance of each Controller.
// since we want to inject dependencies, we need to provide a custom implementation.
Server.registerServiceFactory(new ServiceFactory())

// tells the server which classes to use as Controllers
Server.buildServices(app,
  ChatMateController,
  ChatController,
  EmojiController,
  ExperienceController,
  UserController
)

const logContext = createLogContext(globalContext.getClassInstance('logService'), { name: 'App' })

process.on('unhandledRejection', (error) => {
  // from https://stackoverflow.com/questions/46629778/debug-unhandled-promise-rejections
  // to debug timers quietly failing: https://github.com/nodejs/node/issues/22149#issuecomment-410706698
  logContext.logError('process.unhandledRejection', error)
  throw error
})

if (env('useFakeControllers')) {
  logContext.logInfo(`Using fake controllers`)
}

logContext.logInfo(`Using live ID ${liveId}`)

globalContext.initialise().then(() => {
  app.listen(port, () => {
    logContext.logInfo(`Server is listening on ${port}`)
  })
})
