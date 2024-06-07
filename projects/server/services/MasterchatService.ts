import { ChatResponse, Masterchat, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/shared/context/context'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'
import { firstOrDefault } from '@rebel/shared/util/typescript'
import ApiService from '@rebel/server/services/abstract/ApiService'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ChatMateError, NoContextTokenError, NoYoutubeChatMessagesError } from '@rebel/shared/util/error'
import PlatformApiStore, { ApiPlatform } from '@rebel/server/stores/PlatformApiStore'
import AuthStore from '@rebel/server/stores/AuthStore'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'

export type ChatMateModeratorStatus = {
  isModerator: boolean

  /** The time at which we know for certain the moderator state of ChatMate. It might have changed since then, but we have no way of knowing. */
  time: number
}

export type MasterchatAuthentication = {
  isActive: boolean
  lastUpdated: Date | null
}

type PartialMasterchat = Pick<Masterchat, 'fetch' | 'fetchMetadata' | 'hide' | 'unhide' | 'timeout' | 'addModerator' | 'removeModerator'> & {
  // underlying instance
  masterchat: Masterchat
}

type Deps = Dependencies<{
  logService: LogService
  masterchatStatusService: StatusService
  masterchatFactory: MasterchatFactory
  chatStore: ChatStore
  platformApiStore: PlatformApiStore
  authStore: AuthStore
  channelId: string
  chatMateStateService: ChatMateStateService
}>

export default class MasterchatService extends ApiService {
  private readonly masterchatFactory: MasterchatFactory
  private readonly chatStore: ChatStore
  private readonly authStore: AuthStore
  private readonly channelId: string
  private readonly chatMateStateService: ChatMateStateService

  constructor (deps: Deps) {
    const name = MasterchatService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('masterchatStatusService')
    const platformApiStore = deps.resolve('platformApiStore')
    const apiPlatform: ApiPlatform = 'masterchat'
    const timeout = null
    super(name, logService, statusService, platformApiStore, apiPlatform, timeout, true)

    this.masterchatFactory = deps.resolve('masterchatFactory')
    this.chatStore = deps.resolve('chatStore')
    this.authStore = deps.resolve('authStore')
    this.channelId = deps.resolve('channelId')
    this.chatMateStateService = deps.resolve('chatMateStateService')
  }

  public addMasterchat (streamerId: number, liveId: string) {
    // we keep track of the streamer-liveId pairs to avoid having to get livestream info later on.
    // we technically don't need this right now (as we can get the liveId for fetch requests easily enough),
    // but it is required for ChatMate actions, which are not currently used anywhere
    const map = this.chatMateStateService.getMasterchatStreamerIdLiveIdMap()
    if (map.has(streamerId)) {
      throw new ChatMateError(`Cannot add masterchat entry for streamer ${streamerId} and liveId ${liveId} because one already exists with liveId ${map.get(streamerId)}`)
    }

    map.set(streamerId, liveId)
  }

  public removeMasterchat (streamerId: number) {
    this.chatMateStateService.getMasterchatStreamerIdLiveIdMap().delete(streamerId)
  }

  /** If an instance of Masterchat is active and authenticated, returns information about the credentials.
   * Returns null if the authentication is missing or not active - some Masterchat requests will fail. */
  public async checkAuthentication (): Promise<MasterchatAuthentication | null> {
    const map = this.chatMateStateService.getMasterchatStreamerIdLiveIdMap()
    const liveId = firstOrDefault(map, null)
    if (liveId == null) {
      return null
    }

    const accessToken = await this.authStore.loadYoutubeWebAccessToken(this.channelId)
    return {
      isActive: accessToken != null && this.chatMateStateService.getMasterchatLoggedIn(),
      lastUpdated: accessToken?.updateTime ?? null
    }
  }

  // the second argument is not optional to avoid bugs where `fetch(continuationToken)` is erroneously called.
  public async fetch (streamerId: number, continuationToken: string | undefined): Promise<ChatResponse> {
    const masterchat = await this.getMasterchatForStreamer(streamerId)

    // this quirky code is required for typescript to recognise which overloaded `fetch` method we are using
    if (continuationToken == null) {
      return await masterchat.fetch()
    } else {
      return await masterchat.fetch(continuationToken)
    }
  }

  public async fetchMetadata (streamerId: number): Promise<Metadata> {
    const masterchat = await this.getMasterchatForStreamer(streamerId)
    return await masterchat.fetchMetadata()
  }

  /** Returns the YouTube external channel ID to which the livestream belongs. LiveId does not have to belong to a ChatMate streamer. */
  public async getChannelIdFromAnyLiveId (liveId: string): Promise<string> {
    const masterchat = await this.masterchatFactory.create(liveId)
    const metadata = await masterchat.fetchMetadata()
    return metadata.channelId
  }

  /** Gets the moderation status at the time of the last chat message received to the streamer's livestream. It may have changed since then.
   * @throws {@link NoYoutubeChatMessagesError}: When the streamer has not yet received any chat messages.
  */
  public async getChatMateModeratorStatus (streamerId: number): Promise<ChatMateModeratorStatus> {
    // CHAT-615: it is a known limitation that this last chat message may have been for a different youtube channel (if the streamer changed their primary channel),
    // which would lead us to check the moderation status of the wrong channel.
    const lastMessage = await this.chatStore.getLastYoutubeChat(streamerId)
    if (lastMessage == null) {
      throw new NoYoutubeChatMessagesError('Unable to find any chat messages for the given streamer.')
    } else if (lastMessage.contextToken == null) {
      throw new NoContextTokenError(`Unable to find a context token associated with the latest chat message of ID ${lastMessage.id}, and thus was unable to determine the moderation status.`)
    }

    const masterchat = await this.masterchatFactory.create('')
    const catalog = await masterchat.getActionCatalog(lastMessage.contextToken)

    return {
      isModerator: catalog != null && (
        catalog.addModerator != null ||
        catalog.hide != null ||
        catalog.pin != null ||
        catalog.removeModerator != null ||
        catalog.timeout != null ||
        catalog.unhide != null ||
        catalog.unpin != null
      ),
      time: lastMessage.time.getTime()
    }
  }

  /** Returns true if the channel was banned. False indicates that the 'hide channel' option
   * was not included in the latest chat item's context menu. */
  public async banYoutubeChannel (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    const masterchat = await this.getMasterchatForStreamer(streamerId)

    // only returns null if the action is not available in the context menu, e.g. if the user is already banned
    const result = await masterchat.hide(contextMenuEndpointParams)
    return result != null
  }

  /** Times out the channel by 5 minutes. This cannot be undone.
   *
   * Returns true if the channel was banned. False indicates that the 'timeout channel'
   * option was not included in the latest chat item's context menu. */
  public async timeout (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    const masterchat = await this.getMasterchatForStreamer(streamerId)
    const result = await masterchat.timeout(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was banned. False indicates that the 'unhide channel' option
   * was not included in the latest chat item's context menu. */
  public async unbanYoutubeChannel (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    const masterchat = await this.getMasterchatForStreamer(streamerId)
    const result = await masterchat.unhide(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was modded. False indicates that the 'add moderator' option
   * was not included in the latest chat item's context menu. */
  public async mod (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    const masterchat = await this.getMasterchatForStreamer(streamerId)
    const result = await masterchat.addModerator(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was modded. False indicates that the 'remove moderator' option
   * was not included in the latest chat item's context menu. */
  public async unmod (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    const masterchat = await this.getMasterchatForStreamer(streamerId)
    const result = await masterchat.removeModerator(contextMenuEndpointParams)
    return result != null
  }

  private async getMasterchatForStreamer (streamerId: number): Promise<PartialMasterchat> {
    const map = this.chatMateStateService.getMasterchatStreamerIdLiveIdMap()
    if (!map.has(streamerId)) {
      throw new ChatMateError(`Masterchat instance for streamer ${streamerId} can not be created. Does an active livestream exist?`)
    }

    const liveId = map.get(streamerId)!
    return this.createWrapper(streamerId, liveId, await this.masterchatFactory.create(liveId))
  }

  // insert some middleware to deal with automatic logging and status updates :)
  // note that some endpoints are livestream agnostic
  private createWrapper (streamerId: number, liveId: string, masterchat: Masterchat): PartialMasterchat {
    // it is important that we wrap the `request` param as an anonymous function itself, because
    // masterchat.* are methods, and so not doing the wrapping would lead to `this` changing context.
    const fetch = super.wrapRequest((...args) => masterchat.fetch(...args), `masterchat[${liveId}].fetch`, streamerId, true)
    const fetchMetadata = super.wrapRequest(() => masterchat.fetchMetadata(), `masterchat[${liveId}].fetchMetadata`, streamerId, true)
    const hide = super.wrapRequest((arg) => masterchat.hide(arg), `masterchat[${liveId}].hide`, streamerId)
    const unhide = super.wrapRequest((arg) => masterchat.unhide(arg), `masterchat[${liveId}].unhide`, streamerId)
    const timeout = super.wrapRequest((arg) => masterchat.timeout(arg), `masterchat[${liveId}].timeout`, streamerId)
    const addModerator = super.wrapRequest((arg) => masterchat.addModerator(arg), `masterchat[${liveId}].addModerator`, streamerId)
    const removeModerator = super.wrapRequest((arg) => masterchat.removeModerator(arg), `masterchat[${liveId}].removeModerator`, streamerId)

    return { masterchat, fetch, fetchMetadata, hide, unhide, timeout, addModerator, removeModerator }
  }
}
