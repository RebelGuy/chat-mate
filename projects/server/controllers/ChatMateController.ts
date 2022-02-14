import { LiveStatus } from '@rebel/masterchat'
import { ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import ExperienceService from '@rebel/server/services/ExperienceService'
import StatusService, { ApiStatus } from '@rebel/server/services/StatusService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { getLivestreamLink } from '@rebel/server/util/text'
import { GET, Path, QueryParam } from 'typescript-rest'

type GetStatusResponse = ApiResponse<1, {
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

type GetEventsResponse = ApiResponse<2, {
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  events: ChatMateEvent[]
}>

type ChatMateEvent = {
  type: 'levelUp',

  // the time at which the event occurred
  timestamp: number,
  data: {
    channelName: string,
    oldLevel: number,
    newLevel: number
  }
}

type Deps = ControllerDependencies<{
  livestreamStore: LivestreamStore
  viewershipStore: ViewershipStore
  statusService: StatusService
  experienceService: ExperienceService
  channelStore: ChannelStore
}>

@Path(buildPath('chatMate'))
export default class ChatMateController extends ControllerBase {
  readonly livestreamStore: LivestreamStore
  readonly viewershipStore: ViewershipStore
  readonly statusService: StatusService
  readonly experienceService: ExperienceService
  readonly channelStore: ChannelStore

  constructor (deps: Deps) {
    super(deps, 'chatMate')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.statusService = deps.resolve('statusService')
    this.experienceService = deps.resolve('experienceService')
    this.channelStore = deps.resolve('channelStore')
  }

  @GET
  @Path('/status')
  public async getStatus (): Promise<GetStatusResponse> {
    const builder = this.registerResponseBuilder('status', 1)
    try {
      const livestreamStatus = await this.getLivestreamStatus()
      const apiStatus = this.statusService.getApiStatus()

      return builder.success({ livestreamStatus, apiStatus })
    } catch (e: any) {
      return builder.failure(e.message)
    }
  }

  @GET
  @Path('/events')
  public async getEvents (
    @QueryParam('since') since: number
  ): Promise<GetEventsResponse> {
    const builder = this.registerResponseBuilder('events', 2)
    if (since == null) {
      return builder.failure(400, `A value for 'since' must be provided.`)
    }

    try {
      const diffs = await this.experienceService.getLevelDiffs(since + 1)
      const channels = await Promise.all(diffs.map(d => this.channelStore.getCurrent(d.channelId)))

      let events: ChatMateEvent[] = []
      for (let i = 0; i < diffs.length; i++) {
        const diff = diffs[i]
        const channel = channels[i]

        events.push({
          type: 'levelUp',
          timestamp: diff.timestamp,
          data: {
            channelName: channel!.infoHistory[0].name,
            newLevel: diff.endLevel.level,
            oldLevel: diff.startLevel.level
          }
        })
      }

      return builder.success({
        reusableTimestamp: events.at(-1)?.timestamp ?? since,
        events
      })
    } catch (e: any) {
      return builder.failure(e.message)
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
      startTime: livestream.start?.getTime() ?? null,
      endTime: livestream.end?.getTime() ?? null,
      liveViewers: viewers?.viewCount ?? null,
      livestreamLink: link,
      status
    }
  }
}
