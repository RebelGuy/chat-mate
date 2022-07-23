import 'source-map-support/register' // so our stack traces are converted to the typescript equivalent files/lines
import express from 'express'
import { Server } from 'typescript-rest'
import ChatController from '@rebel/server/controllers/ChatController'
import env from './globals'
import { ContextProvider, setContextProvider } from '@rebel/server/context/context'
import ChatService from '@rebel/server/services/ChatService'
import ServiceFactory from '@rebel/server/context/CustomServiceFactory'
import ChatStore from '@rebel/server/stores/ChatStore'
import MasterchatProvider from '@rebel/server/factories/MasterchatFactory'
import path from 'node:path'
import FileService from '@rebel/server/services/FileService'
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
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import ClientCredentialsAuthProviderFactory from '@rebel/server/factories/ClientCredentialsAuthProviderFactory'
import HelixEventService from '@rebel/server/services/HelixEventService'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import PunishmentService from '@rebel/server/services/PunishmentService'
import PunishmentStore from '@rebel/server/stores/PunishmentStore'
import YoutubeTimeoutRefreshService from '@rebel/server/services/YoutubeTimeoutRefreshService'
import PunishmentController from '@rebel/server/controllers/PunishmentController'
import EventDispatchService from '@rebel/server/services/EventDispatchService'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import ApplicationInsightsService from '@rebel/server/services/ApplicationInsightsService'
import { Express } from 'express-serve-static-core'
import LogsQueryClientProvider from '@rebel/server/providers/LogsQueryClientProvider'
import LogQueryService from '@rebel/server/services/LogQueryService'
import LogController from '@rebel/server/controllers/LogController'
import { TimeoutError } from '@rebel/server/util/error'

//
// "Over-engineering is the best thing since sliced bread."
//   - some Rebel Guy
//

const app: Express = express()

const port = env('port')
const dataPath = path.resolve(__dirname, `../../data/`)
const twitchClientId = env('twitchClientId')
const twitchClientSecret = env('twitchClientSecret')
const twitchChannelName = env('twitchChannelName')
const twitchAccessToken = env('twitchAccessToken')
const twitchRefreshToken = env('twitchRefreshToken')
const applicationInsightsConnectionString = env('applicationinsightsConnectionString')
const enableDbLogging = env('enableDbLogging')
const isLocal = env('isLocal')
const hostName = env('websiteHostname')
const managedIdentityClientId = env('managedIdentityClientId')
const logAnalyticsWorkspaceId = env('logAnalyticsWorkspaceId')
const dbSemaphoreConcurrent = env('dbSemaphoreConcurrent')
const dbSemaphoreTimeout = env('dbSemaphoreTimeout')
const dbTransactionTimeout = env('dbTransactionTimeout')

const globalContext = ContextProvider.create()
  .withObject('app', app)
  .withProperty('port', port)
  .withProperty('auth', env('auth'))
  .withProperty('channelId', env('channelId'))
  .withProperty('dataPath', dataPath)
  .withProperty('isLive', env('nodeEnv') === 'release')
  .withProperty('databaseUrl', env('databaseUrl'))
  .withProperty('disableExternalApis', env('useFakeControllers') === true)
  .withProperty('twitchClientId', twitchClientId)
  .withProperty('twitchClientSecret', twitchClientSecret)
  .withProperty('twitchChannelName', twitchChannelName)
  .withProperty('twitchAccessToken', twitchAccessToken)
  .withProperty('twitchRefreshToken', twitchRefreshToken)
  .withProperty('applicationInsightsConnectionString', applicationInsightsConnectionString)
  .withProperty('enableDbLogging', enableDbLogging)
  .withProperty('dbSemaphoreConcurrent', dbSemaphoreConcurrent)
  .withProperty('dbSemaphoreTimeout', dbSemaphoreTimeout)
  .withProperty('dbTransactionTimeout', dbTransactionTimeout)
  .withProperty('isLocal', isLocal)
  .withProperty('hostName', hostName)
  .withProperty('managedIdentityClientId', managedIdentityClientId)
  .withProperty('logAnalyticsWorkspaceId', logAnalyticsWorkspaceId)
  .withHelpers('experienceHelpers', ExperienceHelpers)
  .withHelpers('timerHelpers', TimerHelpers)
  .withHelpers('dateTimeHelpers', DateTimeHelpers)
  .withFactory('refreshingAuthProviderFactory', RefreshingAuthProviderFactory)
  .withFactory('clientCredentialsAuthProviderFactory', ClientCredentialsAuthProviderFactory)
  .withClass('eventDispatchService', EventDispatchService)
  .withClass('fileService', FileService)
  .withClass('applicationInsightsService', ApplicationInsightsService)
  .withClass('logsQueryClientProvider', LogsQueryClientProvider)
  .withClass('logQueryService', LogQueryService)
  .withClass('logService', LogService)
  .withClass('masterchatFactory', MasterchatFactory)
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
  .withClass('punishmentStore', PunishmentStore)
  .withClass('youtubeTimeoutRefreshService', YoutubeTimeoutRefreshService)
  .withClass('twurpleService', TwurpleService)
  .withClass('punishmentService', PunishmentService)
  .withClass('experienceService', ExperienceService)
  .withClass('customEmojiStore', CustomEmojiStore)
  .withClass('emojiService', EmojiService)
  .withClass('chatService', ChatService)
  .withClass('chatFetchService', ChatFetchService)
  .withClass('followerStore', FollowerStore)
  .withClass('helixEventService', HelixEventService)
  .build()

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
  next()
})

app.get('/', (_, res) => res.sendFile('default.html', { root: __dirname }))
app.get('/robots933456.txt', (_, res) => res.sendFile('robots.txt', { root: __dirname }))
app.get('/robots.txt', (_, res) => res.sendFile('robots.txt', { root: __dirname }))

// this is middleware - we can supply an ordered collection of such functions,
// and they will run in order to do common operations on the request before it
// reaches the controllers.
app.use((req, res, next) => {
  // todo: do auth here, and fail if not authorised

  // go to the next handler
  next()
})

app.use(async (req, res, next) => {
  const context = globalContext.asParent()
    .withClass('chatMateController', ChatMateController)
    .withClass('chatController', ChatController)
    .withClass('emojiController', EmojiController)
    .withClass('experienceController', ExperienceController)
    .withClass('userController', UserController)
    .withClass('punishmentController', PunishmentController)
    .withClass('logController', LogController)
    .build()
  await context.initialise()
  setContextProvider(req, context)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
  UserController,
  PunishmentController,
  LogController
)

const logContext = createLogContext(globalContext.getClassInstance('logService'), { name: 'App' })

process.on('unhandledRejection', (error) => {
  if (error instanceof TimeoutError) {
    // when a db request queues a high number of callbacks in the semaphore, timing out the first
    // callback will correctly fail the request, but there may be more callbacks whose timeout
    // error takes a bit longer to fire. at that point, though, there won't be a listener anymore
    // (because the original request has already failed) and errors will bubble up to this point.
    // we can safely ignore them
    return
  }

  // from https://stackoverflow.com/questions/46629778/debug-unhandled-promise-rejections
  // to debug timers quietly failing: https://github.com/nodejs/node/issues/22149#issuecomment-410706698
  logContext.logError('process.unhandledRejection', error)
  throw error
})

if (env('useFakeControllers')) {
  logContext.logInfo(`Using fake controllers`)
}

globalContext.initialise().then(() => {
  app.listen(port, () => {
    logContext.logInfo(`Server is listening on ${port}`)
  })
})
