import 'source-map-support/register' // so our stack traces are converted to the typescript equivalent files/lines
import express, { NextFunction, Request, Response } from 'express'
import { Server } from 'typescript-rest'
import ChatController from '@rebel/server/controllers/ChatController'
import env from './globals'
import { ContextProvider, setContextProvider } from '@rebel/server/context/context'
import ChatService from '@rebel/server/services/ChatService'
import ServiceFactory from '@rebel/server/context/CustomServiceFactory'
import ChatStore from '@rebel/server/stores/ChatStore'
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
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
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
import RankStore from '@rebel/server/stores/RankStore'
import AdminService from '@rebel/server/services/rank/AdminService'
import RankHelpers from '@rebel/server/helpers/RankHelpers'
import RankController from '@rebel/server/controllers/RankController'
import ModService from '@rebel/server/services/rank/ModService'
import RankService from '@rebel/server/services/rank/RankService'
import * as fs from 'fs'
import StreamlabsProxyService from '@rebel/server/services/StreamlabsProxyService'
import DonationFetchService from '@rebel/server/services/DonationFetchService'
import DonationStore from '@rebel/server/stores/DonationStore'
import DonationService from '@rebel/server/services/DonationService'
import DonationHelpers from '@rebel/server/helpers/DonationHelpers'
import DonationController from '@rebel/server/controllers/DonationController'
import LivestreamController from '@rebel/server/controllers/LivestreamController'
import CustomEmojiEligibilityService from '@rebel/server/services/CustomEmojiEligibilityService'
import ChatMateEventService from '@rebel/server/services/ChatMateEventService'
import { ApiResponse } from '@rebel/server/controllers/ControllerBase'
import AccountController from '@rebel/server/controllers/AccountController'
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import AccountStore from '@rebel/server/stores/AccountStore'
import ApiService from '@rebel/server/controllers/ApiService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import StreamerController from '@rebel/server/controllers/StreamerController'
import StreamerService from '@rebel/server/services/StreamerService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import WebsocketFactory from '@rebel/server/factories/WebsocketFactory'
import LinkService from '@rebel/server/services/LinkService'
import LinkStore from '@rebel/server/stores/LinkStore'

//
// "Over-engineering is the best thing since sliced bread."
//   - some Rebel Guy
//

const app: Express = express()

const port = env('port')
const dataPath = path.resolve(__dirname, `../../data/`)
const twitchClientId = env('twitchClientId')
const twitchClientSecret = env('twitchClientSecret')
const applicationInsightsConnectionString = env('applicationinsightsConnectionString')
const enableDbLogging = env('enableDbLogging')
const hostName = env('websiteHostname')
const managedIdentityClientId = env('managedIdentityClientId')
const logAnalyticsWorkspaceId = env('logAnalyticsWorkspaceId')
const dbSemaphoreConcurrent = env('dbSemaphoreConcurrent')
const dbSemaphoreTimeout = env('dbSemaphoreTimeout')
const dbTransactionTimeout = env('dbTransactionTimeout')
const streamlabsAccessToken = env('streamlabsAccessToken')

const globalContext = ContextProvider.create()
  .withObject('app', app)
  .withProperty('port', port)
  .withProperty('channelId', env('channelId'))
  .withProperty('dataPath', dataPath)
  .withProperty('nodeEnv', env('nodeEnv'))
  .withProperty('databaseUrl', env('databaseUrl'))
  .withProperty('disableExternalApis', env('useFakeControllers') === true)
  .withProperty('twitchClientId', twitchClientId)
  .withProperty('twitchClientSecret', twitchClientSecret)
  .withProperty('applicationInsightsConnectionString', applicationInsightsConnectionString)
  .withProperty('enableDbLogging', enableDbLogging)
  .withProperty('dbSemaphoreConcurrent', dbSemaphoreConcurrent)
  .withProperty('dbSemaphoreTimeout', dbSemaphoreTimeout)
  .withProperty('dbTransactionTimeout', dbTransactionTimeout)
  .withProperty('hostName', hostName)
  .withProperty('managedIdentityClientId', managedIdentityClientId)
  .withProperty('logAnalyticsWorkspaceId', logAnalyticsWorkspaceId)
  .withProperty('streamlabsAccessToken', streamlabsAccessToken)
  .withHelpers('experienceHelpers', ExperienceHelpers)
  .withHelpers('timerHelpers', TimerHelpers)
  .withHelpers('dateTimeHelpers', DateTimeHelpers)
  .withHelpers('rankHelpers', RankHelpers)
  .withHelpers('donationHelpers', DonationHelpers)
  .withHelpers('accountHelpers', AccountHelpers)
  .withFactory('refreshingAuthProviderFactory', RefreshingAuthProviderFactory)
  .withFactory('clientCredentialsAuthProviderFactory', ClientCredentialsAuthProviderFactory)
  .withFactory('websocketFactory', WebsocketFactory)
  .withClass('eventDispatchService', EventDispatchService)
  .withClass('fileService', FileService)
  .withClass('applicationInsightsService', ApplicationInsightsService)
  .withClass('logsQueryClientProvider', LogsQueryClientProvider)
  .withClass('logQueryService', LogQueryService)
  .withClass('logService', LogService)
  .withClass('dbProvider', DbProvider)
  .withClass('authStore', AuthStore)
  .withClass('masterchatFactory', MasterchatFactory)
  .withClass('masterchatStatusService', StatusService)
  .withClass('twurpleStatusService', StatusService)
  .withClass('streamlabsStatusService', StatusService)
  .withClass('masterchatProxyService', MasterchatProxyService)
  .withClass('twurpleAuthProvider', TwurpleAuthProvider)
  .withClass('twurpleChatClientProvider', TwurpleChatClientProvider)
  .withClass('twurpleApiClientProvider', TwurpleApiClientProvider)
  .withClass('twurpleApiProxyService', TwurpleApiProxyService)
  .withClass('streamlabsProxyService', StreamlabsProxyService)
  .withClass('livestreamStore', LivestreamStore)
  .withClass('viewershipStore', ViewershipStore)
  .withClass('accountStore', AccountStore)
  .withClass('streamerStore', StreamerStore)
  .withClass('channelStore', ChannelStore)
  .withClass('streamerChannelService', StreamerChannelService)
  .withClass('livestreamService', LivestreamService)
  .withClass('rankStore', RankStore)
  .withClass('adminService', AdminService)
  .withClass('experienceStore', ExperienceStore)
  .withClass('chatStore', ChatStore)
  .withClass('channelService', ChannelService)
  .withClass('punishmentStore', PunishmentStore)
  .withClass('youtubeTimeoutRefreshService', YoutubeTimeoutRefreshService)
  .withClass('twurpleService', TwurpleService)
  .withClass('punishmentService', PunishmentService)
  .withClass('experienceService', ExperienceService)
  .withClass('customEmojiStore', CustomEmojiStore)
  .withClass('customEmojiEligibilityService', CustomEmojiEligibilityService)
  .withClass('emojiService', EmojiService)
  .withClass('chatService', ChatService)
  .withClass('chatFetchService', ChatFetchService)
  .withClass('followerStore', FollowerStore)
  .withClass('helixEventService', HelixEventService)
  .withClass('modService', ModService)
  .withClass('rankService', RankService)
  .withClass('donationStore', DonationStore)
  .withClass('donationService', DonationService)
  .withClass('donationFetchService', DonationFetchService)
  .withClass('chatMateEventService', ChatMateEventService)
  .withClass('streamerService', StreamerService)
  .withClass('linkStore', LinkStore)
  .withClass('linkService', LinkService)
  .build()

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
  res.header('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

app.use((req, res, next) => {
  // intercept the JSON body so we can customise the error code
  // "inspired" by https://stackoverflow.com/a/57553226
  const send = res.send.bind(res)

  res.send = (body) => {
    if (res.headersSent) {
      // already sent
      return res
    }

    let responseBody: ApiResponse<any, any> | null
    if (body == null) {
      responseBody = null
    } else {
      try {
        responseBody = JSON.parse(body)
      } catch (e: any) {
        // the response body was just a message (string), so we must construct the error object explicitly
        if (res.statusCode === 200) {
          throw new Error('It is expected that only errors are ever sent with a simple message.')
        }

        responseBody = {
          schema: 1,
          timestamp: new Date().getTime(),
          success: false,
          error: {
            errorCode: res.statusCode as any,
            errorType: res.statusMessage ?? 'Internal Server Error',
            message: body
          }
        }
        res.set('Content-Type', 'application/json')
      }
    }

    if (responseBody?.success === false) {
      res.status(responseBody.error.errorCode ?? 500)
    }

    return send(JSON.stringify(responseBody))
  }

  next()
})

app.get('/', (_, res) => res.sendFile('default.html', { root: __dirname }))
app.get('/robots933456.txt', (_, res) => res.sendFile('robots.txt', { root: __dirname }))
app.get('/robots.txt', (_, res) => res.sendFile('robots.txt', { root: __dirname }))
app.get('/favicon_local.ico', (_, res) => res.end(fs.readFileSync('./favicon_local.ico')))
app.get('/favicon_debug.ico', (_, res) => res.end(fs.readFileSync('./favicon_debug.ico')))
app.get('/favicon_release.ico', (_, res) => res.end(fs.readFileSync('./favicon_release.ico')))

const logContext = createLogContext(globalContext.getClassInstance('logService'), { name: 'App' })

app.use(async (req, res, next) => {
  const context = globalContext.asParent()
    .withObject('request', req) // these are required because, within the ApiService, we don't have access to @Context yet at the time that preprocessors fire
    .withObject('response', res)
    .withClass('apiService', ApiService)
    .withClass('chatMateController', ChatMateController)
    .withClass('chatController', ChatController)
    .withClass('emojiController', EmojiController)
    .withClass('experienceController', ExperienceController)
    .withClass('userController', UserController)
    .withClass('punishmentController', PunishmentController)
    .withClass('logController', LogController)
    .withClass('rankController', RankController)
    .withClass('donationController', DonationController)
    .withClass('livestreamController', LivestreamController)
    .withClass('accountController', AccountController)
    .withClass('streamerController', StreamerController)
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
  LogController,
  RankController,
  DonationController,
  LivestreamController,
  AccountController,
  StreamerController
)

// error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // any errors reaching here are unhandled - just return a 500
  logContext.logError('Express encountered error for the request at ' + req.url + ':', err)

  if (!res.headersSent) {
    res.sendStatus(500)
  }

  // don't call `next(error)` - the next middleware would be the default express error handler,
  // which just logs the error to the console.
  // also by not calling `next`, we indicate to express that the request handling is over and the response should be sent
})

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
