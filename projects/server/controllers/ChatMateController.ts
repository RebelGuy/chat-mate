import { LiveStatus } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { buildPath } from '@rebel/server/controllers/BaseEndpoint'
import StatusService, { ApiStatus } from '@rebel/server/services/StatusService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { ApiSchema } from '@rebel/server/types'
import { getLivestreamLink } from '@rebel/server/util/text'
import { GET, Path } from "typescript-rest"

type GetStatusResponse = ApiSchema<1, {
  // the timestamp at which the response was generated
  timestamp: number

  livestreamStatus: LivestreamStatus
  apiStatus: ApiStatus
}>

type LivestreamStatus = {
  // public YouTube link to the livestream
  livestreamLink: string
  status: Exclude<LiveStatus, 'unknown'>

  // not defined if status is `not_started`
  startTime: number | null

  // only defined if status is `finished`
  endTime: number | null

  // only defined if status is `live`
  liveViewers: number | null
}

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  viewershipStore: ViewershipStore
  statusService: StatusService
}>

@Path(buildPath('chatMate'))
export default class ChatMateController {
  readonly livestreamStore: LivestreamStore
  readonly viewershipStore: ViewershipStore
  readonly statusService: StatusService

  constructor (dependencies: Deps) {
    this.livestreamStore = dependencies.resolve('livestreamStore')
    this.viewershipStore = dependencies.resolve('viewershipStore')
    this.statusService = dependencies.resolve('statusService')
  }

  @GET
  @Path('/status')
  public async getStatus (): Promise<GetStatusResponse> {
    const livestreamStatus = await this.getLivestreamStatus()
    const apiStatus = this.statusService.getApiStatus()

    return {
      schema: 1,
      timestamp: Date.now(),
      livestreamStatus,
      apiStatus
    }
  }

  private async getLivestreamStatus (): Promise<LivestreamStatus> {
    const livestream = this.livestreamStore.currentLivestream
    const link = getLivestreamLink(livestream.liveId)

    let viewers: { time: Date, viewCount: number } | null = null
    let status: Exclude<LiveStatus, 'unknown'>
    if (livestream.start == null) {
      status = 'not_started'
    } else if (livestream.end == null) {
      status = 'live'
      viewers = await this.viewershipStore.getLatestLiveCount()
    } else {
      status = 'finished'
    }

    return {
      startTime: livestream.start?.getDate() ?? null,
      endTime: livestream.end?.getDate() ?? null,
      liveViewers: viewers?.viewCount ?? null,
      livestreamLink: link,
      status
    }
  }
}
