import { ChatResponse, Masterchat, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/shared/context/context'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'
import { firstOrDefault } from '@rebel/shared/util/typescript'
import ApiService from '@rebel/server/services/abstract/ApiService'

type PartialMasterchat = Pick<Masterchat, 'fetch' | 'fetchMetadata' | 'hide' | 'unhide' | 'timeout' | 'addModerator' | 'removeModerator'> & {
  // underlying instance
  masterchat: Masterchat
}

type Deps = Dependencies<{
  logService: LogService
  masterchatStatusService: StatusService
  masterchatFactory: MasterchatFactory
}>

export default class MasterchatService extends ApiService {
  private readonly masterchatFactory: MasterchatFactory

  // note that some endpoints are livestream-agnostic
  private readonly wrappedMasterchats: Map<number, PartialMasterchat>

  constructor (deps: Deps) {
    const name = MasterchatService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('masterchatStatusService')
    const timeout = null
    super(name, logService, statusService, timeout)

    this.masterchatFactory = deps.resolve('masterchatFactory')

    this.wrappedMasterchats = new Map()
  }

  public addMasterchat (streamerId: number, liveId: string) {
    if (this.wrappedMasterchats.has(streamerId)) {
      throw new Error(`Cannot add masterchat instance for streamer ${streamerId} and liveId ${liveId} because one already exists with liveId ${liveId}`)
    }

    const newMasterchat = this.createWrapper(liveId, this.masterchatFactory.create(liveId))
    this.wrappedMasterchats.set(streamerId, newMasterchat)
  }

  public removeMasterchat (streamerId: number) {
    const masterchat = this.wrappedMasterchats.get(streamerId)
    if (masterchat != null) {
      masterchat.masterchat.stop()
    }

    this.wrappedMasterchats.delete(streamerId)
  }

  /** If an instance of masterchat is active, returns whether the credentials are currently active and valid.
   * If false, no user is authenticated and some requests will fail. */
  public checkCredentials () {
    const masterchat = firstOrDefault(this.wrappedMasterchats, null)
    if (masterchat == null) {
      return null
    } else {
      return !masterchat.masterchat.isLoggedOut
    }
  }

  // the second argument is not optional to avoid bugs where `fetch(continuationToken)` is erroneously called.
  public async fetch (streamerId: number, continuationToken: string | undefined): Promise<ChatResponse> {
    // this quirky code is required for typescript to recognise which overloaded `fetch` method we are using
    if (continuationToken == null) {
      return await this.wrappedMasterchats.get(streamerId)!.fetch()
    } else {
      return await this.wrappedMasterchats.get(streamerId)!.fetch(continuationToken)
    }
  }

  public async fetchMetadata (streamerId: number): Promise<Metadata> {
    return await this.wrappedMasterchats.get(streamerId)!.fetchMetadata()
  }

  /** Returns the YouTube external channel ID to which the livestream belongs. LiveId does not have to belong to an existing Masterchat instance. */
  public async getChannelIdFromAnyLiveId (liveId: string): Promise<string> {
    const masterchat = this.masterchatFactory.create(liveId)
    const metadata = await masterchat.fetchMetadata()
    return metadata.channelId
  }

  /** Returns true if the channel was banned. False indicates that the 'hide channel' option
   * was not included in the latest chat item's context menu. */
  public async banYoutubeChannel (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    if (!this.wrappedMasterchats.has(streamerId)) {
      throw new Error(`Masterchat instance for streamer ${streamerId} has not yet been initialised. Does an active livestream exist?`)
    }

    // only returns null if the action is not available in the context menu, e.g. if the user is already banned
    const result = await this.wrappedMasterchats.get(streamerId)!.hide(contextMenuEndpointParams)
    return result != null
  }

  /** Times out the channel by 5 minutes. This cannot be undone.
   *
   * Returns true if the channel was banned. False indicates that the 'timeout channel'
   * option was not included in the latest chat item's context menu. */
  public async timeout (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    if (!this.wrappedMasterchats.has(streamerId)) {
      throw new Error(`Masterchat instance for streamer ${streamerId} has not yet been initialised. Does an active livestream exist?`)
    }

    const result = await this.wrappedMasterchats.get(streamerId)!.timeout(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was banned. False indicates that the 'unhide channel' option
   * was not included in the latest chat item's context menu. */
  public async unbanYoutubeChannel (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    if (!this.wrappedMasterchats.has(streamerId)) {
      throw new Error(`Masterchat instance for streamer ${streamerId} has not yet been initialised. Does an active livestream exist?`)
    }

    const result = await this.wrappedMasterchats.get(streamerId)!.unhide(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was modded. False indicates that the 'add moderator' option
   * was not included in the latest chat item's context menu. */
  public async mod (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    if (!this.wrappedMasterchats.has(streamerId)) {
      throw new Error(`Masterchat instance for streamer ${streamerId} has not yet been initialised. Does an active livestream exist?`)
    }

    const result = await this.wrappedMasterchats.get(streamerId)!.addModerator(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was modded. False indicates that the 'remove moderator' option
   * was not included in the latest chat item's context menu. */
  public async unmod (streamerId: number, contextMenuEndpointParams: string): Promise<boolean> {
    if (!this.wrappedMasterchats.has(streamerId)) {
      throw new Error(`Masterchat instance for streamer ${streamerId} has not yet been initialised. Does an active livestream exist?`)
  }

    const result = await this.wrappedMasterchats.get(streamerId)!.removeModerator(contextMenuEndpointParams)
    return result != null
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createWrapper = (liveId: string, masterchat: Masterchat): PartialMasterchat => {
    // it is important that we wrap the `request` param as an anonymous function itself, because
    // masterchat.* are methods, and so not doing the wrapping would lead to `this` changing context.
    const fetch = super.wrapRequest((...args) => masterchat.fetch(...args), `masterchat[${liveId}].fetch`)
    const fetchMetadata = super.wrapRequest(() => masterchat.fetchMetadata(), `masterchat[${liveId}].fetchMetadata`)
    const hide = super.wrapRequest((arg) => masterchat.hide(arg), `masterchat[${liveId}].hide`)
    const unhide = super.wrapRequest((arg) => masterchat.unhide(arg), `masterchat[${liveId}].unhide`)
    const timeout = super.wrapRequest((arg) => masterchat.timeout(arg), `masterchat[${liveId}].timeout`)
    const addModerator = super.wrapRequest((arg) => masterchat.addModerator(arg), `masterchat[${liveId}].addModerator`)
    const removeModerator = super.wrapRequest((arg) => masterchat.removeModerator(arg), `masterchat[${liveId}].removeModerator`)

    return { masterchat, fetch, fetchMetadata, hide, unhide, timeout, addModerator, removeModerator }
  }
}
