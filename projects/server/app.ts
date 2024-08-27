import 'source-map-support/register' // so our stack traces are converted to the typescript equivalent files/lines
import express, { NextFunction, Request, Response } from 'express'
import { Server } from 'typescript-rest'
import ChatController from '@rebel/server/controllers/ChatController'
import env from './globals'
import { ContextProvider, setContextProvider } from '@rebel/shared/context/context'
import ChatService from '@rebel/server/services/ChatService'
import ServiceFactory from '@rebel/shared/context/CustomServiceFactory'
import ChatStore from '@rebel/server/stores/ChatStore'
import path from 'node:path'
import FileService from '@rebel/server/services/FileService'
import LogService from '@rebel/server/services/LogService'
import DbProvider from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ExperienceHelpers from '@rebel/server/helpers/ExperienceHelpers'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LivestreamService from '@rebel/server/services/LivestreamService'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import ChatMateController from '@rebel/server/controllers/ChatMateController'
import StatusService from '@rebel/server/services/StatusService'
import MasterchatService from '@rebel/server/services/MasterchatService'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceController from '@rebel/server/controllers/ExperienceController'
import UserController from '@rebel/server/controllers/UserController'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import EmojiController from '@rebel/server/controllers/EmojiController'
import MasterchatFetchService from '@rebel/server/services/MasterchatFetchService'
import CustomEmojiService from '@rebel/server/services/CustomEmojiService'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import TwurpleService from '@rebel/server/services/TwurpleService'
import AuthStore from '@rebel/server/stores/AuthStore'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import AppTokenAuthProviderFactory from '@rebel/server/factories/AppTokenAuthProviderFactory'
import HelixEventService from '@rebel/server/services/HelixEventService'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import PunishmentController from '@rebel/server/controllers/PunishmentController'
import EventDispatchService from '@rebel/server/services/EventDispatchService'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import ApplicationInsightsService from '@rebel/server/services/ApplicationInsightsService'
import { Express } from 'express-serve-static-core'
import { ChatMateError, TimeoutError } from '@rebel/shared/util/error'
import RankStore from '@rebel/server/stores/RankStore'
import AdminService from '@rebel/server/services/rank/AdminService'
import RankHelpers from '@rebel/shared/helpers/RankHelpers'
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
import AccountController from '@rebel/server/controllers/AccountController'
import AccountHelpers from '@rebel/shared/helpers/AccountHelpers'
import AccountStore from '@rebel/server/stores/AccountStore'
import ApiService from '@rebel/server/controllers/ApiService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import StreamerController from '@rebel/server/controllers/StreamerController'
import StreamerService from '@rebel/server/services/StreamerService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import WebsocketFactory from '@rebel/server/factories/WebsocketFactory'
import LinkService from '@rebel/server/services/LinkService'
import LinkStore from '@rebel/server/stores/LinkStore'
import CommandService from '@rebel/server/services/command/CommandService'
import CommandStore from '@rebel/server/stores/CommandStore'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import LinkDataService from '@rebel/server/services/LinkDataService'
import AccountService from '@rebel/server/services/AccountService'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import UserService from '@rebel/server/services/UserService'
import GenericStore from '@rebel/server/stores/GenericStore'
import { createLogContext } from '@rebel/shared/ILogService'
import AdminController from '@rebel/server/controllers/AdminController'
import WebService from '@rebel/server/services/WebService'
import StreamerTwitchEventService from '@rebel/server/services/StreamerTwitchEventService'
import { ApiResponse } from '@rebel/api-models/types'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import MasterchatStore from '@rebel/server/stores/MasterchatStore'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'
import YoutubeService from '@rebel/server/services/YoutubeService'
import { YoutubeApiClientProvider } from '@rebel/server/providers/YoutubeApiClientProvider'
import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import YoutubeAuthClientFactory from '@rebel/server/factories/YoutubeAuthClientFactory'
import AggregateLivestreamService from '@rebel/server/services/AggregateLivestreamService'
import ExternalRankDataService from '@rebel/server/services/rank/ExternalRankDataService'
import ChannelEventService from '@rebel/server/services/ChannelEventService'
import PlatformApiStore from '@rebel/server/stores/PlatformApiStore'
import CacheService from '@rebel/server/services/CacheService'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import ImageService from '@rebel/server/services/ImageService'
import EmojiService from '@rebel/server/services/EmojiService'
import EmojiStore from '@rebel/server/stores/EmojiStore'
import expressWs from 'express-ws'
import WebsocketClient from '@rebel/server/controllers/WebsocketClient'
import FollowerService from '@rebel/server/services/FollowerService'
import * as AI from 'applicationinsights'
import S3ClientProvider from '@rebel/server/providers/S3ClientProvider'
import LiveReactionService from '@rebel/server/services/LiveReactionService'
import LiveReactionStore from '@rebel/server/stores/LiveReactionStore'
import VisitorService from '@rebel/server/services/VisitorService'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import ImageStore from '@rebel/server/stores/ImageStore'
import TaskService from '@rebel/server/services/task/TaskService'
import CleanUpYoutubeContextTokensTask from '@rebel/server/services/task/CleanUpYoutubeContextTokensTask'
import TaskStore from '@rebel/server/stores/TaskStore'
import CleanUpApiCallsTask from '@rebel/server/services/task/CleanUpApiCallsTask'

//
// "Over-engineering is the best thing since sliced bread."
//   - some Rebel Guy
//

const STARTUP_TIME = Date.now()

const main = async () => {
  const app: Express = express()
  const wsApp = expressWs(app, undefined, { wsOptions: { }})

  const port = env('port')
  const studioUrl = env('studioUrl')
  const dataPath = path.resolve(__dirname, `../../data/`)
  const twitchClientId = env('twitchClientId')
  const twitchClientSecret = env('twitchClientSecret')
  const applicationInsightsConnectionString = env('applicationinsightsConnectionString')
  const dbLogLevel = env('dbLogLevel')
  const apiLogLevel = env('apiLogLevel')
  const debugLogOutput = env('debugLogOutput')
  const infoLogOutput = env('infoLogOutput')
  const warningLogOutput = env('warningLogOutput')
  const errorLogOutput = env('errorLogOutput')
  const hostName = env('websiteHostname')
  const dbSemaphoreConcurrent = env('dbSemaphoreConcurrent')
  const dbSemaphoreTimeout = env('dbSemaphoreTimeout')
  const dbTransactionTimeout = env('dbTransactionTimeout')
  const dbSlowQueryThreshold = env('dbSlowQueryThreshold')
  const streamlabsAccessToken = env('streamlabsAccessToken')
  const twitchUsername = env('twitchUsername')
  const s3Region = env('s3Region')
  const s3Domain = env('s3Domain')
  const s3Key = env('s3Key')
  const s3Secret = env('s3Secret')
  const s3Bucket = env('s3Bucket')

  let isAdministrativeMode = false
  let isContextInitialised = false

  let appInsightsClient: AI.TelemetryClient | null
  if (applicationInsightsConnectionString == null) {
    appInsightsClient = null
  } else {
    console.debug('Starting ApplicationInsights client...')
    AI.setup(applicationInsightsConnectionString)
      .setAutoCollectConsole(false) // doesn't seem to work properly - instead, we manually track these via `trackTrace()` for better control
      .setSendLiveMetrics(true) // so we can monitor the app in real-time
      .start()
    appInsightsClient = AI.defaultClient
    console.debug('Successfully started ApplicationInsights client')
  }

  const globalContext = ContextProvider.create()
    .withVariable('isAdministrativeMode', () => isAdministrativeMode)
    .withVariable('isContextInitialised', () => isContextInitialised)
    .withObject('app', app)
    .withObject('appInsightsClient', appInsightsClient)
    .withProperty('port', port)
    .withProperty('studioUrl', studioUrl)
    .withProperty('channelId', env('channelId'))
    .withProperty('youtubeClientId', env('youtubeClientId'))
    .withProperty('youtubeClientSecret', env('youtubeClientSecret'))
    .withProperty('dataPath', dataPath)
    .withProperty('nodeEnv', env('nodeEnv'))
    .withProperty('databaseUrl', env('databaseUrl'))
    .withProperty('disableExternalApis', env('useFakeControllers') === true)
    .withProperty('twitchClientId', twitchClientId)
    .withProperty('twitchClientSecret', twitchClientSecret)
    .withProperty('dbLogLevel', dbLogLevel)
    .withProperty('apiLogLevel', apiLogLevel)
    .withProperty('debugLogOutput', debugLogOutput)
    .withProperty('infoLogOutput', infoLogOutput)
    .withProperty('warningLogOutput', warningLogOutput)
    .withProperty('errorLogOutput', errorLogOutput)
    .withProperty('dbSemaphoreConcurrent', dbSemaphoreConcurrent)
    .withProperty('dbSemaphoreTimeout', dbSemaphoreTimeout)
    .withProperty('dbTransactionTimeout', dbTransactionTimeout)
    .withProperty('dbSlowQueryThreshold', dbSlowQueryThreshold)
    .withProperty('hostName', hostName)
    .withProperty('streamlabsAccessToken', streamlabsAccessToken)
    .withProperty('twitchUsername', twitchUsername)
    .withProperty('chatMateRegisteredUserName', env('chatMateRegisteredUserName'))
    .withProperty('ngrokAuthToken', env('ngrokAuthToken')!)
    .withProperty('s3Region', s3Region)
    .withProperty('s3Domain', s3Domain)
    .withProperty('s3Key', s3Key)
    .withProperty('s3Secret', s3Secret)
    .withProperty('s3Bucket', s3Bucket)
    .withHelpers('experienceHelpers', ExperienceHelpers)
    .withHelpers('timerHelpers', TimerHelpers)
    .withHelpers('dateTimeHelpers', DateTimeHelpers)
    .withHelpers('rankHelpers', RankHelpers)
    .withHelpers('donationHelpers', DonationHelpers)
    .withHelpers('accountHelpers', AccountHelpers)
    .withHelpers('commandHelpers', CommandHelpers)
    .withClass('refreshingAuthProviderFactory', RefreshingAuthProviderFactory)
    .withClass('appTokenAuthProviderFactory', AppTokenAuthProviderFactory)
    .withClass('websocketFactory', WebsocketFactory)
    .withClass('fileService', FileService)
    .withClass('applicationInsightsService', ApplicationInsightsService)
    .withClass('logService', LogService)
    .withClass('dbProvider', DbProvider)
    .withClass('visitorStore', VisitorStore)
    .withClass('chatMateStateService', ChatMateStateService)
    .withClass('eventDispatchService', EventDispatchService)
    .withClass('webService', WebService)
    .withClass('authStore', AuthStore)
    .withClass('masterchatFactory', MasterchatFactory)
    .withClass('masterchatStatusService', StatusService)
    .withClass('twurpleStatusService', StatusService)
    .withClass('youtubeStatusService', StatusService)
    .withClass('streamlabsStatusService', StatusService)
    .withClass('livestreamStore', LivestreamStore)
    .withClass('chatStore', ChatStore)
    .withClass('platformApiStore', PlatformApiStore)
    .withClass('masterchatService', MasterchatService)
    .withClass('twurpleAuthProvider', TwurpleAuthProvider)
    .withClass('twurpleChatClientProvider', TwurpleChatClientProvider)
    .withClass('twurpleApiClientProvider', TwurpleApiClientProvider)
    .withClass('twurpleApiProxyService', TwurpleApiProxyService)
    .withClass('streamlabsProxyService', StreamlabsProxyService)
    .withClass('accountStore', AccountStore)
    .withClass('streamerStore', StreamerStore)
    .withClass('channelStore', ChannelStore)
    .withClass('streamerChannelStore', StreamerChannelStore)
    .withClass('rankStore', RankStore)
    .withClass('streamerChannelService', StreamerChannelService)
    .withClass('cacheService', CacheService)
    .withClass('youtubeAuthClientFactory', YoutubeAuthClientFactory)
    .withClass('youtubeAuthProvider', YoutubeAuthProvider)
    .withClass('youtubeApiClientProvider', YoutubeApiClientProvider)
    .withClass('youtubeApiProxyService', YoutubeApiProxyService)
    .withClass('livestreamService', LivestreamService)
    .withClass('adminService', AdminService)
    .withClass('experienceStore', ExperienceStore)
    .withClass('accountService', AccountService)
    .withClass('twurpleService', TwurpleService)
    .withClass('linkStore', LinkStore)
    .withClass('userService', UserService)
    .withClass('youtubeService', YoutubeService)
    .withClass('rankService', RankService)
    .withClass('punishmentService', PunishmentService)
    .withClass('genericStore', GenericStore)
    .withClass('aggregateLivestreamService', AggregateLivestreamService)
    .withClass('imageService', ImageService)
    .withClass('s3ClientProvider', S3ClientProvider)
    .withClass('s3ProxyService', S3ProxyService)
    .withClass('imageStore', ImageStore)
    .withClass('channelService', ChannelService)
    .withClass('externalRankDataService', ExternalRankDataService)
    .withClass('modService', ModService)
    .withClass('externalRankEventService', ExternalRankEventService)
    .withClass('experienceService', ExperienceService)
    .withClass('customEmojiStore', CustomEmojiStore)
    .withClass('customEmojiEligibilityService', CustomEmojiEligibilityService)
    .withClass('customEmojiService', CustomEmojiService)
    .withClass('commandStore', CommandStore)
    .withClass('donationStore', DonationStore)
    .withClass('donationService', DonationService)
    .withClass('linkService', LinkService)
    .withClass('linkCommand', LinkCommand)
    .withClass('commandService', CommandService)
    .withClass('channelEventService', ChannelEventService)
    .withClass('emojiStore', EmojiStore)
    .withClass('emojiService', EmojiService)
    .withClass('chatService', ChatService)
    .withClass('masterchatStore', MasterchatStore)
    .withClass('followerStore', FollowerStore)
    .withClass('liveReactionStore', LiveReactionStore)
    .withClass('liveReactionService', LiveReactionService)
    .withClass('masterchatFetchService', MasterchatFetchService)
    .withClass('followerService', FollowerService)
    .withClass('helixEventService', HelixEventService)
    .withClass('donationFetchService', DonationFetchService)
    .withClass('chatMateEventService', ChatMateEventService)
    .withClass('streamerService', StreamerService)
    .withClass('linkDataService', LinkDataService)
    .withClass('streamerTwitchEventService', StreamerTwitchEventService)
    .withClass('visitorService', VisitorService)
    .withClass('cleanUpYoutubeContextTokensTask', CleanUpYoutubeContextTokensTask)
    .withClass('cleanUpApiCallsTask', CleanUpApiCallsTask)
    .withClass('taskStore', TaskStore)
    .withClass('taskService', TaskService)
    .build()

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin ?? '*')
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

      let responseBody: ApiResponse<any> | null
      if (body == null) {
        responseBody = null
      } else {
        try {
          responseBody = JSON.parse(body)
        } catch (e: any) {
          // the response body was just a message (string), so we must construct the error object explicitly
          if (res.statusCode === 200) {
            throw new ChatMateError('It is expected that only errors are ever sent with a simple message.')
          }

          responseBody = {
            timestamp: new Date().getTime(),
            success: false,
            error: {
              errorCode: res.statusCode as any,
              errorType: res.statusMessage ?? 'Internal Server Error',
              internalErrorType: 'Error',
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

  app.get('/', (_, res) => {
    let contents = fs.readFileSync(path.join(__dirname, 'default.html')).toString()
    contents = contents.replace('__SERVER_STARTUP_TIME_PLACEHOLDER__', STARTUP_TIME.toString())
    res.end(contents)
  })
  app.get('/robots933456.txt', (_, res) => res.sendFile('robots.txt', { root: __dirname }))
  app.get('/robots.txt', (_, res) => res.sendFile('robots.txt', { root: __dirname }))
  app.get('/favicon_local.ico', (_, res) => res.sendFile('favicon_local.ico', { root: __dirname }))
  app.get('/favicon_debug.ico', (_, res) => res.sendFile('favicon_debug.ico', { root: __dirname }))
  app.get('/favicon_release.ico', (_, res) => res.sendFile('favicon_release.ico', { root: __dirname }))

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
      .withClass('rankController', RankController)
      .withClass('donationController', DonationController)
      .withClass('livestreamController', LivestreamController)
      .withClass('accountController', AccountController)
      .withClass('streamerController', StreamerController)
      .withClass('adminController', AdminController)
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
    RankController,
    DonationController,
    LivestreamController,
    AccountController,
    StreamerController,
    AdminController
  )


  // test using https://piehost.com/websocket-tester
  wsApp.app.ws('/ws', async (client, request, next) => {
    const websocketContext = globalContext.asParent()
      .withObject('request', request)
      .withObject('response', {} as any)
      .withObject('wsClient', client)
      .withClass('apiService', ApiService)
      .withClass('websocketService', WebsocketClient)
      .build()

    await websocketContext.initialise()
  })

  // at this point, none of the routes have matched, so we want to return a custom formatted error
  // from https://expressjs.com/en/starter/faq.html#how-do-i-handle-404-responses
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return
    }

    // keep propagating if this is a twitch webhook request
    if (req.path.startsWith('/twitch')) {
      next()
      return
    }

    res.status(404).send('Not found.')
  })

  // error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // any errors reaching here are unhandled - just return a 500
    logContext.logError(`Express encountered error for the ${req.method} request at ${req.url}:`, err)

    if (!res.headersSent) {
      res.status(500).send(err.message)
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

  process.on('uncaughtException', (error) => {
    logContext.logError('process.uncaughtException', error)
    throw error
  })

  if (env('useFakeControllers')) {
    logContext.logInfo(`Using fake controllers`)
  }

  // ensure the server can still run if Twitch auth fails, so that we can re-authenticate via the Studio Twitch admin page
  await globalContext.initialise((erroredClass, stage, e) => {
    if (stage === 'initialise' &&
      (erroredClass instanceof TwurpleAuthProvider || erroredClass instanceof YoutubeAuthProvider)
    ) {
      isAdministrativeMode = true
      return 'ignore'
    }

    return 'abort'
  })

  app.listen(port, () => {
    logContext.logInfo(`Server is listening on ${port}`)
    isContextInitialised = true
  })
}

void main()
