import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { ConnectionAdapter, DirectConnectionAdapter, EventSubHttpListener, EventSubMiddleware } from '@twurple/eventsub-http'
import { EventSubSubscription, EventSubUserAuthorizationGrantEvent, EventSubUserAuthorizationRevokeEvent } from '@twurple/eventsub-base'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import LogService, { onTwurpleClientLog } from '@rebel/server/services/LogService'
import { HelixEventSubApi, HelixEventSubSubscription } from '@twurple/api/lib'
import FileService from '@rebel/server/services/FileService'
import { Express } from 'express-serve-static-core'
import { EventSubHttpBase } from '@twurple/eventsub-http/lib/EventSubHttpBase'
import { NodeEnv } from '@rebel/server/globals'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import EventDispatchService, { EventData, EVENT_ADD_PRIMARY_CHANNEL, EVENT_REMOVE_PRIMARY_CHANNEL } from '@rebel/server/services/EventDispatchService'
import { getUserName } from '@rebel/server/services/ChannelService'
import { SubscriptionStatus } from '@rebel/server/services/StreamerTwitchEventService'
import { keysOf } from '@rebel/shared/util/objects'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import { createLogContext, LogContext } from '@rebel/shared/ILogService'
import { LogLevel } from '@twurple/chat/lib'
import AuthStore from '@rebel/server/stores/AuthStore'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import { assertUnreachable, waitUntil } from '@rebel/shared/util/typescript'
import { nonNull } from '@rebel/shared/util/arrays'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import LivestreamService from '@rebel/server/services/LivestreamService'
import { ChatMateError } from '@rebel/shared/util/error'
import FollowerService from '@rebel/server/services/FollowerService'

// if you're wondering why we are dynamically importing some things - it's because they can't be resolved at runtime on the deployed server. for whatever reason the javascript gods have decided today.

// Ngrok session expires automatically after this time. We can increase the session time by signing up, but
// there seems to be no way to pass the auth details to the adapter so we have to restart the session manually
// every now and then
const NGROK_MAX_SESSION = 3600 * 2 * 1000

// https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
const EVENT_SUB_TYPES = ['followers', 'ban', 'unban', 'mod', 'unmod', 'streamStart', 'streamEnd'] as const

export type EventSubType = (typeof EVENT_SUB_TYPES)[number]

type SubscriptionInfo = {
  subscription: EventSubSubscription | null
  errorMessage: string | null
  lastChange: number
}

type Deps = Dependencies<{
  disableExternalApis: boolean
  nodeEnv: NodeEnv
  hostName: string | null
  twurpleApiClientProvider: TwurpleApiClientProvider
  followerService: FollowerService
  timerHelpers: TimerHelpers
  logService: LogService
  fileService: FileService
  app: Express
  streamerChannelService: StreamerChannelService
  eventDispatchService: EventDispatchService
  ngrokAuthToken: string
  isAdministrativeMode: () => boolean
  isContextInitialised: () => boolean
  dateTimeHelpers: DateTimeHelpers
  authStore: AuthStore
  twurpleAuthProvider: TwurpleAuthProvider
  externalRankEventService: ExternalRankEventService
  livestreamService: LivestreamService
}>

// this class is so complicated, I don't want to write unit tests for it because the unit tests themselves would also be complicated, which defeats the purpose.
// if it ain't broken, don't fix it

/** This should only subscribe to and relay events to other services, but not do any work (other than some data transformations). */
export default class HelixEventService extends ContextClass {
  public readonly name = HelixEventService.name

  private readonly disableExternalApis: boolean
  private readonly nodeEnv: NodeEnv
  private readonly hostName: string | null
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly followerService: FollowerService
  private readonly timerHelpers: TimerHelpers
  private readonly logService: LogService
  private readonly logContext: LogContext
  private readonly fileService: FileService
  private readonly app: Express
  private readonly streamerChannelService: StreamerChannelService
  private readonly eventDispatchService: EventDispatchService
  private readonly ngrokAuthToken: string
  private readonly isAdministrativeMode: () => boolean
  private readonly isContextInitialised: () => boolean
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly authStore: AuthStore
  private readonly twurpleAuthProvider: TwurpleAuthProvider
  private readonly externalRankEventService: ExternalRankEventService
  private readonly livestreamService: LivestreamService

  private initialisedStreamerEvents: boolean = false
  private listener: EventSubHttpListener | null = null
  private eventSubBase!: EventSubHttpBase
  private eventSubApi!: HelixEventSubApi

  // note: the `subscription.verify` property will update on the initial (unverified) subscription object
  private streamerSubscriptionInfos: Map<number, Partial<Record<EventSubType, SubscriptionInfo>>> = new Map()
  private enabledSubscriptionIds: Set<string> = new Set()

  // internal event listeners
  private verificationListeners: Set<typeof this.onVerify> = new Set()
  private revocationListeners: Set<typeof this.onRevoke> = new Set()
  private subscriptionCreationFailureListeners: Set<typeof this.onSubscriptionCreateFailure> = new Set()
  private subscriptionDeleteSuccessListeners: Set<typeof this.onSubscriptionDeleteSuccess> = new Set()
  private subscriptionDeleteFailureListeners: Set<typeof this.onSubscriptionDeleteFailure> = new Set()

  constructor (deps: Deps) {
    super()

    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.nodeEnv = deps.resolve('nodeEnv')
    this.hostName = deps.resolve('hostName')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.followerService = deps.resolve('followerService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
    this.fileService = deps.resolve('fileService')
    this.app = deps.resolve('app')
    this.streamerChannelService = deps.resolve('streamerChannelService')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.ngrokAuthToken = deps.resolve('ngrokAuthToken')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
    this.isContextInitialised = deps.resolve('isContextInitialised')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.authStore = deps.resolve('authStore')
    this.twurpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.externalRankEventService = deps.resolve('externalRankEventService')
    this.livestreamService = deps.resolve('livestreamService')
  }

  public override initialise () {
    if (this.disableExternalApis) {
      this.logService.logInfo(this, 'Skipping initialisation because external APIs are disabled.')
      return
    } else if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    this.eventDispatchService.onData(EVENT_ADD_PRIMARY_CHANNEL, data => this.onPrimaryChannelAdded(data))
    this.eventDispatchService.onData(EVENT_REMOVE_PRIMARY_CHANNEL, data => this.onPrimaryChannelRemoved(data))

    // there is no need to initialise everything right now - wait for the server to be set up first,
    // then subscribe to events (this could take a long time if there are many streamers)
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      await waitUntil(() => this.isContextInitialised(), 500, 5 * 60_000)
      this.logService.logInfo(this, 'Starting initial subscriptions to Helix events...')

      // https://twurple.js.org/docs/getting-data/eventsub/listener-setup.html
      // we have to use the clientCredentialsApiClient, for some reason the refreshing one doesn't work
      const client = this.twurpleApiClientProvider.getClientApi()
      this.eventSubApi = client.eventSub

      if (this.nodeEnv === 'local') {
        // for some inexplicable reason whose sole purpose is to make our lives harder, the ngrok js client doesn't get the auth token from the normal ngrok config file.
        // instead, we have to set it manually
        const ngrok = await import('@ngrok/ngrok')
        await ngrok.authtoken(this.ngrokAuthToken)

        // from https://discuss.dev.twitch.tv/t/cancel-subscribe-webhook-events/21064/3
        // we have to go through our existing callbacks and terminate them, otherwise we won't be able to re-subscribe (HTTP 429 - "Too many requests")
        // this is explicitly required for ngrok as per the docs because ngrok assigns a new host name every time we run it
        await this.eventSubApi.deleteAllSubscriptions()

        this.listener = await this.createNewListener()
        this.eventSubBase = this.listener
        this.listener.start()
        this.timerHelpers.createRepeatingTimer({ behaviour: 'start', interval: NGROK_MAX_SESSION * 0.9, callback: () => this.refreshNgrok() })
        this.subscribeToGlobalEvents()
        await this.initialiseSubscriptions()
        this.logService.logInfo(this, 'Finished initial subscriptions to Helix events via the EventSub API [Ngrok listener]')
      } else {
        // can't use the listener - have to inject the middleware
        const middleware = new EventSubMiddleware({
          apiClient: this.twurpleApiClientProvider.getClientApi(),
          pathPrefix: '/twitch',
          hostName: this.hostName!,
          secret: this.getSecret(),
          logger: {
            custom: {
              log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
            }
          }
        })
        this.eventSubBase = middleware
        middleware.apply(this.app)

        try {
          await middleware.markAsReady()

          const subscriptions = await this.getAllSubscriptionsFromTwitch()
          const readableSubscriptions = subscriptions.map(([id, sub]) => `${id}: ${sub.status}`)
          this.logService.logInfo(this, 'Retrieved', readableSubscriptions.length, 'existing EventSub subscriptions (broken subscriptions will be deleted):', readableSubscriptions)

          await this.eventSubApi.deleteBrokenSubscriptions()

          subscriptions.filter(([_, sub]) => sub.status === 'enabled').forEach(([id]) => this.enabledSubscriptionIds.add(id))

          this.subscribeToGlobalEvents()
          await this.initialiseSubscriptions()
          this.logService.logInfo(this, 'Finished initial subscriptions to Helix events via the EventSub API [Middleware listener]')
        } catch (e) {
          this.logService.logError(this, 'Failed to initialise Helix events.', e)
        }
      }

      this.initialisedStreamerEvents = true
    }, 0)
  }

  public getEventSubscriptions (streamerId: number): Record<EventSubType, SubscriptionStatus> {
    const result = {} as Record<EventSubType, SubscriptionStatus>

    // set base status for all events, and overwrite it below for the events that we know about
    const baseStatus: SubscriptionStatus = {
      status: this.initialisedStreamerEvents ? 'inactive' : 'pending',
      lastChange: this.dateTimeHelpers.ts()
    }
    EVENT_SUB_TYPES.forEach(type => result[type] = baseStatus)

    const infos = this.streamerSubscriptionInfos.get(streamerId) ?? {}
    for (const type of EVENT_SUB_TYPES) {
      const info = infos[type]
      if (info != null) {
        const error = info.errorMessage
        const subscription = info.subscription
        const lastChange = info.lastChange
        const requiresAuth = requiresAuthorisation(info)

        if (error != null) {
          result[type] = {
            status: 'inactive',
            message: error.includes('subscription missing proper authorization') ? 'Unable to subscribe to event because of missing permissions.' : error,
            lastChange: lastChange,
            requiresAuthorisation: requiresAuth
          }
        } else if (subscription == null) {
          result[type] = {
            status: 'inactive',
            lastChange: lastChange
          }
        } else {
          result[type] = {
            status: subscription.verified || this.enabledSubscriptionIds.has(subscription.id) ? 'active' : 'pending',
            lastChange: lastChange
          }
        }
      }
    }

    return result
  }

  public async resetAllSubscriptions () {
    this.logService.logInfo(this, 'Resetting all Twitch event subscriptions')

    await this.eventSubApi.deleteAllSubscriptions()
    this.streamerSubscriptionInfos = new Map()
    await this.initialiseSubscriptions()
  }

  private async getAllSubscriptionsFromTwitch (): Promise<[twurpleId: string, subscription: HelixEventSubSubscription][]> {
    // from https://github.com/twurple/twurple/blob/main/packages/eventsub-http/src/EventSubHttpBase.ts#L132
    const rawSubscriptions = await this.eventSubApi.getSubscriptionsPaginated().getAll()

    const urlPrefix = `https://${this.hostName}/twitch/event/`
    return nonNull(rawSubscriptions.map(sub => {
      if (sub._transport.method === 'webhook') {
        const url = sub._transport.callback
        if (url.startsWith(urlPrefix)) {
          const id = url.slice(urlPrefix.length)
          return [id, sub]
        }
      }
      return undefined
    }))
  }

  private subscribeToGlobalEvents () {
    /* eslint-disable @typescript-eslint/no-misused-promises */
    this.eventSubBase.onVerify(this.onVerify)
    this.eventSubBase.onRevoke(this.onRevoke)
    this.eventSubBase.onSubscriptionCreateSuccess((subscription) => this.logService.logInfo(this, 'eventSub.onSubscriptionCreateSuccess', 'subscription:', subscription.id))
    this.eventSubBase.onSubscriptionCreateFailure(this.onSubscriptionCreateFailure)
    this.eventSubBase.onSubscriptionDeleteSuccess(this.onSubscriptionDeleteSuccess)
    this.eventSubBase.onSubscriptionDeleteFailure(this.onSubscriptionDeleteFailure)

    this.eventSubBase.onUserAuthorizationGrant(this.onUserAuthorizationGrant)
    this.eventSubBase.onUserAuthorizationRevoke(this.onUserAuthorizationRevoke)
    /* eslint-enable @typescript-eslint/no-misused-promises */

    this.logService.logInfo(this, 'Subscribed to base events')
  }

  private onVerify = (success: boolean, subscription: EventSubSubscription) => {
    this.logService.logInfo(this, `eventSub.onVerify - success: ${success}, subscription: ${subscription.id}`)
    this.enabledSubscriptionIds.add(subscription.id)
    this.verificationListeners.forEach(listener => listener(success, subscription))
  }

  private onRevoke = (subscription: EventSubSubscription) => {
    this.logService.logWarning(this, `eventSub.onRevoke - subscription: ${subscription.id}`)
    this.enabledSubscriptionIds.delete(subscription.id)
    this.revocationListeners.forEach(listener => listener(subscription))
  }

  private onSubscriptionCreateFailure = (subscription: EventSubSubscription, error: Error) => {
    this.logService.logError(this, `eventSub.onSubscriptionCreateFailure - subscription: ${subscription.id}`, error)
    this.enabledSubscriptionIds.delete(subscription.id)
    this.subscriptionCreationFailureListeners.forEach(listener => listener(subscription, error))
  }

  private onSubscriptionDeleteSuccess = (subscription: EventSubSubscription) => {
    this.logService.logInfo(this, `eventSub.onSubscriptionDeleteSuccess - subscription: ${subscription.id}`)
    this.enabledSubscriptionIds.delete(subscription.id)
    this.subscriptionDeleteSuccessListeners.forEach(listener => listener(subscription))
  }

  private onSubscriptionDeleteFailure = (subscription: EventSubSubscription, error: Error) => {
    this.logService.logError(this, `eventSub.onSubscriptionDeleteFailure - subscription: ${subscription.id}`, error)
    this.subscriptionDeleteFailureListeners.forEach(listener => listener(subscription, error))
  }

  private onUserAuthorizationGrant = async (data: EventSubUserAuthorizationGrantEvent) => {
    this.logService.logInfo(this, 'eventSub.onUserAuthorizationGrant', data.userName)

    const streamerId = await this.streamerChannelService.getStreamerFromTwitchChannelName(data.userName)
    if (streamerId == null) {
      // I don't know if this is possible
      return
    }

    this.logService.logInfo(this, `Automatically subscribing to channel events for streamer ${streamerId}`)
    await this.subscribeToChannelEventsByChannelName(streamerId, data.userName)
  }

  private onUserAuthorizationRevoke = async (data: EventSubUserAuthorizationRevokeEvent) => {
    this.logService.logInfo(this, 'eventSub.onUserAuthorizationRevoke', data.userName)

    let streamerId: number | null = null
    if (data.userName != null) {
      await this.authStore.tryDeleteTwitchAccessToken(data.userId)
      this.twurpleAuthProvider.removeTokenForUser(data.userId)
      streamerId = await this.streamerChannelService.getStreamerFromTwitchChannelName(data.userName)
    }

    if (streamerId == null) {
      // this can legitimately happen if the Twitch channel is no longer a primary channel and the user revokes access afterwards.
      // in that case, all event subscriptions would have already been removed as part of unsetting the primary channel, and we
      // don't have to do anything here.
      this.logService.logWarning(this, 'Could not find streamer associated with the authorization revoker')
      return
    }

    // the subscriptions themselves have already stopped, but we need to store the error so the streamer can deal with it appropriately in Studio
    for (const type of EVENT_SUB_TYPES) {
      this.setSubscriptionInfo(streamerId, type, null, 'Authorisation has been revoked.')
    }
  }

  private async onPrimaryChannelAdded (data: EventData[typeof EVENT_ADD_PRIMARY_CHANNEL]) {
    if (data.userChannel.platformInfo.platform !== 'twitch') {
      return
    }

    // this means that API requests adding a channel will have to wait until we have initialised our events - but that's ok! it won't happen very often
    await waitUntil(() => this.initialisedStreamerEvents, 500, 5 * 60_000)
    await this.subscribeToChannelEventsByChannelName(data.streamerId, getUserName(data.userChannel))
  }

  private async onPrimaryChannelRemoved (data: EventData[typeof EVENT_REMOVE_PRIMARY_CHANNEL]) {
    if (data.userChannel.platformInfo.platform !== 'twitch') {
      return
    }

    await waitUntil(() => this.initialisedStreamerEvents, 500, 5 * 60_000)
    await this.unsubscribeFromChannelEvents(data.streamerId, getUserName(data.userChannel))
  }

  private async refreshNgrok () {
    try {
      // stop the current Ngrok server/tunnel
      const ngrok = await import('@ngrok/ngrok')
      await this.eventSubApi.deleteAllSubscriptions()
      await ngrok.disconnect()
      await ngrok.kill()
      this.listener!.stop()

      // this will create a new Ngrok server/tunnel with a different address
      this.listener = await this.createNewListener()
      this.eventSubBase = this.listener
      this.listener.start()
      await this.initialiseSubscriptions()
      this.logService.logInfo(this, 'Successfully refreshed the Ngrok server. The EventSub events will continue to work normally.')
    } catch (e) {
      this.logService.logError(this, 'Failed to refresh the Ngrok server. EventSub notifications will not be received for much longer. Please restart the application at your earliest convenience.', e)
    }
  }

  private async initialiseSubscriptions () {
    const streamerChannels = await this.streamerChannelService.getAllTwitchStreamerChannels()

    // initialise the subscriptions one-by-one - I don't know about you, but I don't want to get rate-limited by Twitch
    for (const streamerChannel of streamerChannels) {
      await this.subscribeToChannelEventsByChannelName(streamerChannel.streamerId, streamerChannel.twitchChannelName)
    }
  }

  private async subscribeToChannelEventsByChannelName (streamerId: number, channelName: string) {
    this.logService.logInfo(this, `Starting subscription sequence of Twitch user '${channelName}' (streamer ${streamerId}).`)

    const client = this.twurpleApiClientProvider.getClientApi()
    const user = await client.users.getUserByName(channelName)
    if (user == null) {
      this.logService.logError(this, `Failed to get Twitch user '${channelName}' (streamer ${streamerId}) and thus could not subscribe to channel events`)
      return
    }

    try {
      for (const eventType of EVENT_SUB_TYPES) {
        let onCreateSubscription: () => EventSubSubscription

        /* eslint-disable @typescript-eslint/no-misused-promises */
        if (eventType === 'followers') {
          onCreateSubscription = () => this.eventSubBase.onChannelFollow(user, user, async (e) =>
            await this.followerService.saveNewFollower(streamerId, e.userId, e.userName, e.userDisplayName)
              .catch(err => this.logService.logError(this, `Handler of event ${eventType} encountered an exception:`, err))
          )
        } else if (eventType === 'ban') {
          onCreateSubscription = () => this.eventSubBase.onChannelBan(user, async (e) =>
            await this.externalRankEventService.onTwitchChannelBanned(streamerId, e.userName, e.moderatorName, e.reason, e.endDate?.getTime() ?? null)
              .catch(err => this.logService.logError(this, `Handler of event ${eventType} encountered an exception:`, err))
          )
        } else if (eventType === 'unban') {
          onCreateSubscription = () => this.eventSubBase.onChannelUnban(user, async (e) =>
            await this.externalRankEventService.onTwitchChannelUnbanned(streamerId, e.userName, e.moderatorName)
              .catch(err => this.logService.logError(this, `Handler of event ${eventType} encountered an exception:`, err))
          )
        } else if (eventType === 'mod') {
          onCreateSubscription = () => this.eventSubBase.onChannelModeratorAdd(user, async (e) =>
            await this.externalRankEventService.onTwitchChannelModded(streamerId, e.userName)
              .catch(err => this.logService.logError(this, `Handler of event ${eventType} encountered an exception:`, err))
          )
        } else if (eventType === 'unmod') {
          onCreateSubscription = () => this.eventSubBase.onChannelModeratorRemove(user, async (e) =>
            await this.externalRankEventService.onTwitchChannelUnmodded(streamerId, e.userName)
              .catch(err => this.logService.logError(this, `Handler of event ${eventType} encountered an exception:`, err))
          )
        } else if (eventType === 'streamStart') {
          onCreateSubscription = () => this.eventSubBase.onStreamOnline(user, async (e) =>
            await this.livestreamService.onTwitchLivestreamStarted(streamerId)
              .catch(err => this.logService.logError(this, `Handler of event ${eventType} encountered an exception:`, err))
          )
        } else if (eventType === 'streamEnd') {
          onCreateSubscription = () => this.eventSubBase.onStreamOffline(user, async (e) => {
            await this.livestreamService.onTwitchLivestreamEnded(streamerId)
              .catch(err => this.logService.logError(this, `Handler of event ${eventType} encountered an exception:`, err))
          })
        } else {
          assertUnreachable(eventType)
        }
        /* eslint-enable @typescript-eslint/no-misused-promises */

        await this.createSubscriptionSafe(onCreateSubscription, streamerId, channelName, eventType)
      }

      this.logService.logInfo(this, `Finished subscription sequence of Twitch user '${channelName}' (streamer ${streamerId}).`)
    } catch (e: any) {
      const subscribedTypes = Object.keys(this.streamerSubscriptionInfos.get(streamerId) ?? {})
      this.logService.logError(this, `Failed to complete subscription sequence of Twitch user '${channelName}' (streamer ${streamerId}).`, 'Active subscriptions (may be broken):', subscribedTypes, 'Error:', e)
    }
  }

  private async createSubscriptionSafe (onCreateSubscription: () => EventSubSubscription, streamerId: number, channelName: string, eventType: EventSubType) {
    try {
      let subscription: EventSubSubscription | null = null
      let error: string | null = null
      let hasExistingSubscription = false

      // check first if we have an existing subscription (otherwise our event listeners below will time out!)
      if (this.streamerSubscriptionInfos.has(streamerId)) {
        const existingInfo = this.streamerSubscriptionInfos.get(streamerId)![eventType]
        if (existingInfo != null && existingInfo.errorMessage == null && existingInfo.subscription?.verified === true) {
          subscription = existingInfo.subscription
          hasExistingSubscription = true
        }
      }

      if (subscription == null) {
        subscription = onCreateSubscription()

        if (this.enabledSubscriptionIds.has(subscription.id)) {
          this.logService.logDebug(this, `Subscription to '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}) is already verified. Subscription id: ${subscription.id}`)

        } else {
          // this is kinda nasty... but also kinda not!
          error = await new Promise<string | null>(resolve => {
            // no need to listen to the creationSuccess event - if we are verified, then it must have also been created successfully.
            const verificationListener = (success: boolean, verifiedSubscription: EventSubSubscription) => {
              if (verifiedSubscription.id === subscription!.id) {
                cleanUp()
                resolve(success ? null : 'Failed to verify subscription.')
              }
            }

            const creationFailureListener = (failedSubscription: EventSubSubscription, e: Error) => {
              if (failedSubscription.id === subscription!.id) {
                cleanUp()
                resolve(`Failed to create subscription: ${e.message}`)
              }
            }

            const clearTimeout = this.timerHelpers.setTimeout(() => {
              cleanUp()
              resolve('Failed to create subscription because it took to long.')
            }, 20000)

            const cleanUp = () => {
              this.verificationListeners.delete(verificationListener)
              this.subscriptionCreationFailureListeners.add(creationFailureListener)
              clearTimeout()
            }

            this.verificationListeners.add(verificationListener)
            this.subscriptionCreationFailureListeners.add(creationFailureListener)
          })
        }
      }

      this.setSubscriptionInfo(streamerId, eventType, subscription, error)
      if (hasExistingSubscription) {
        this.logService.logInfo(this, `Already subscribed to '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}). Subscription id: ${subscription.id}`)
      } else if (error == null) {
        this.logService.logInfo(this, `Subscribed to '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}). Subscription id: ${subscription.id}`)
      } else {
        this.logService.logError(this, `Gracefully failed to subscribe to '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}). ${error}`)
      }
    } catch (e: any) {
      this.logService.logError(this, `Unexpectedly failed to subscribe to '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}).`, e)
    }
  }

  private async unsubscribeFromChannelEvents (streamerId: number, channelName: string) {
    if (!this.streamerSubscriptionInfos.has(streamerId)) {
      return
    }

    this.logService.logInfo(this, `Starting subscription removal sequence of Twitch user '${channelName}' (streamer ${streamerId}).`)

    try {
      const subscriptions = this.streamerSubscriptionInfos.get(streamerId)!
      const subscribedTypes = keysOf(subscriptions)
      for (const type of subscribedTypes) {
        await this.removeSubscriptionSafe(subscriptions[type]!.subscription, streamerId, channelName, type)
      }
      this.logService.logInfo(this, `Finished subscription removal sequence of Twitch user '${channelName}' (streamer ${streamerId}).`)
    } catch (e: any) {
      const subscribedTypes = Object.keys(this.streamerSubscriptionInfos.get(streamerId) ?? {})
      this.logService.logError(this, `Failed to complete subscription removal sequence of Twitch user '${channelName}' (streamer ${streamerId}).`, 'Active subscriptions (may be broken):', subscribedTypes, 'Error:', e)
    }
  }

  private async removeSubscriptionSafe (subscription: EventSubSubscription | null, streamerId: number, channelName: string, eventType: EventSubType) {
    try {
      let error: string | null = null
      if (subscription != null) {
        error = await new Promise<string | null>(resolve => {
          const successListener = (createdSubscription: EventSubSubscription) => {
            if (createdSubscription.id === subscription.id) {
              cleanUp()
              resolve(null)
            }
          }

          const failureListener = (failedSubscription: EventSubSubscription, e: Error) => {
            if (failedSubscription.id === subscription.id) {
              cleanUp()
              resolve(`Failed to remove subscription: ${e.message}`)
            }
          }

          const clearTimeout = this.timerHelpers.setTimeout(() => {
            cleanUp()
            resolve('Failed to remove subscription because it took to long.')
          }, 20000)

          const cleanUp = () => {
            this.subscriptionDeleteFailureListeners.delete(failureListener)
            this.subscriptionDeleteSuccessListeners.add(successListener)
            clearTimeout()
          }

          this.subscriptionDeleteFailureListeners.add(failureListener)
          this.subscriptionDeleteSuccessListeners.add(successListener)
          subscription.stop()
        })
      }

      this.setSubscriptionInfo(streamerId, eventType, subscription, error)
      if (error == null) {
        this.logService.logInfo(this, `Unsubscribed from '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}). Subscription id: ${subscription?.id ?? '<none>'}`)
      } else {
        this.logService.logError(this, `Gracefully failed to unsubscribe from '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}). ${error}`)
      }
    } catch (e: any) {
      this.logService.logError(this, `Unexpectedly failed to unsubscribe from '${eventType}' events for Twitch user '${channelName}' (streamer ${streamerId}).`, e)
    }
  }

  private setSubscriptionInfo (streamerId: number, type: EventSubType, subscription: EventSubSubscription | null, errorMessage: string | null) {
    if (!this.streamerSubscriptionInfos.has(streamerId)) {
      this.streamerSubscriptionInfos.set(streamerId, {})
    }

    if (subscription == null && errorMessage == null) {
      const existing = this.streamerSubscriptionInfos.get(streamerId)![type]
      this.enabledSubscriptionIds.delete(existing?.subscription?.id ?? '')
      delete this.streamerSubscriptionInfos.get(streamerId)![type]
    } else {
      this.streamerSubscriptionInfos.get(streamerId)![type] = {
        subscription: subscription,
        errorMessage: errorMessage,
        lastChange: this.dateTimeHelpers.ts()
      }
    }
  }

  private async createNewListener (): Promise<EventSubHttpListener> {
    return new EventSubHttpListener({
      apiClient: this.twurpleApiClientProvider.getClientApi(),
      adapter: await this.createAdapter(),
      secret: this.getSecret(),
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
        }
      }
    })
  }

  private async createAdapter (): Promise<ConnectionAdapter> {
    if (this.nodeEnv === 'local') {
      // debug the Ngrok server at http://localhost:4040/inspect/http
      const NgrokAdapter = await import('@twurple/eventsub-ngrok').then(i => i.NgrokAdapter)
      return new NgrokAdapter()
    } else {
      // this doesn't work - don't create an adapter when deploying the server, instead, use the EventSub middleware
      const key = this.fileService.read('./server/key.pem')
      if (key == null) {
        throw new ChatMateError(`Unable to read SSL private key because the 'key.pem' file could not be found`)
      }

      const cert = this.fileService.read('./server/certificate.pem')
      if (cert == null) {
        throw new ChatMateError(`Unable to read SSL certificate because the 'certificate.pem' file could not be found`)
      }

      return new DirectConnectionAdapter({
        hostName: this.hostName!,
        sslCert: { key, cert }
      })
    }
  }

  private getSecret (): string {
    return `065adade-b312-11ec-b909-0242ac120002-${this.nodeEnv}`
  }
}

function requiresAuthorisation (info: SubscriptionInfo) {
  return info.errorMessage?.toLowerCase().includes('subscription missing proper authorization') // automatically returned from EventSub after failing to subscribe
    || info.errorMessage?.toLowerCase().includes('authorisation has been revoked.') // custom error for when the user has revoked access to the ChatMate Application
}
