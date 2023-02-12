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

export default class MasterchatProxyService extends ApiService {
  private readonly masterchatFactory: MasterchatFactory

  // note that some endpoints are livestream-agnostic
  private readonly wrappedMasterchats: Map<string, PartialMasterchat>

  constructor (deps: Deps) {
    const name = MasterchatProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('masterchatStatusService')
    const timeout = null
    super(name, logService, statusService, timeout)

    this.masterchatFactory = deps.resolve('masterchatFactory')

    this.wrappedMasterchats = new Map()
  }

  public addMasterchat (liveId: string) {
    const newMasterchat = this.createWrapper(liveId, this.masterchatFactory.create(liveId))
    this.wrappedMasterchats.set(liveId, newMasterchat)
  }

  public removeMasterchat (liveId: string) {
    this.wrappedMasterchats.delete(liveId)
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
  public async fetch (liveId: string, continuationToken: string | undefined): Promise<ChatResponse> {
    // this quirky code is required for typescript to recognise which overloaded `fetch` method we are using
    if (continuationToken == null) {
      return await this.wrappedMasterchats.get(liveId)!.fetch()
    } else {
      return await this.wrappedMasterchats.get(liveId)!.fetch(continuationToken)
    }
  }

  public async fetchMetadata (liveId: string): Promise<Metadata> {
    return await this.wrappedMasterchats.get(liveId)!.fetchMetadata()
  }

  /** Returns true if the channel was banned. False indicates that the 'hide channel' option
   * was not included in the latest chat item's context menu. */
  public async banYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    // only returns null if the action is not available in the context menu, e.g. if the user is already banned
    const result = await this.getFirst().hide(contextMenuEndpointParams)
    return result != null
  }

  /** Times out the channel by 5 minutes. This cannot be undone.
   * 
   * Returns true if the channel was banned. False indicates that the 'timeout channel'
   * option was not included in the latest chat item's context menu. */
  public async timeout (contextMenuEndpointParams: string): Promise<boolean> {
    const result = await this.getFirst().timeout(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was banned. False indicates that the 'unhide channel' option
   * was not included in the latest chat item's context menu. */
  public async unbanYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    const result = await this.getFirst().unhide(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was modded. False indicates that the 'add moderator' option
   * was not included in the latest chat item's context menu. */
  public async mod (contextMenuEndpointParams: string): Promise<boolean> {
    const result = await this.getFirst().addModerator(contextMenuEndpointParams)
    return result != null
  }

  /** Returns true if the channel was modded. False indicates that the 'remove moderator' option
   * was not included in the latest chat item's context menu. */
  public async unmod (contextMenuEndpointParams: string): Promise<boolean> {
    const result = await this.getFirst().removeModerator(contextMenuEndpointParams)
    return result != null
  }

  private getFirst () {
    const masterchat = firstOrDefault(this.wrappedMasterchats, null)
    if (masterchat == null) {
      throw new Error('No masterchat instance exists')
    }
    return masterchat
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
