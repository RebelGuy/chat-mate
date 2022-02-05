import { LiveStatus } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { buildPath } from '@rebel/server/controllers/BaseEndpoint'
import { PublicAuthor } from '@rebel/server/models/chat'
import ExperienceService from '@rebel/server/services/ExperienceService'
import StatusService, { ApiStatus } from '@rebel/server/services/StatusService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { ApiSchema } from '@rebel/server/types'
import { getLivestreamLink } from '@rebel/server/util/text'
import { GET, Path, QueryParam } from 'typescript-rest'

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

type GetEventsResponse = ApiSchema<1, {
  // include the timestamp so it can easily be used for the next request
  timestamp: number
  events: ChatMateEvent[]
}>

type ChatMateEvent = {
  type: 'levelUp',

  // the time at which the event occurred
  timestamp: number,
  data: {
    author: string,
    oldLevel: number,
    newLevel: number
  }
}

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  viewershipStore: ViewershipStore
  statusService: StatusService
  experienceService: ExperienceService
  channelStore: ChannelStore
}>

@Path(buildPath('chatMate'))
export default class ChatMateController {
  readonly livestreamStore: LivestreamStore
  readonly viewershipStore: ViewershipStore
  readonly statusService: StatusService
  readonly experienceService: ExperienceService
  readonly channelStore: ChannelStore

  constructor (dependencies: Deps) {
    this.livestreamStore = dependencies.resolve('livestreamStore')
    this.viewershipStore = dependencies.resolve('viewershipStore')
    this.statusService = dependencies.resolve('statusService')
    this.experienceService = dependencies.resolve('experienceService')
    this.channelStore = dependencies.resolve('channelStore')
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

  @GET
  @Path('/events')
  public async getEvents (
    @QueryParam('since') since: number
  ): Promise<GetEventsResponse> {
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
          author: channel!.infoHistory[0].name,
          newLevel: diff.endLevel.level,
          oldLevel: diff.startLevel.level
        }
      })
    }


    return {
      schema: 1,
      timestamp: events.at(-1)?.timestamp ?? since,
      events
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
