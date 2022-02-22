import { LiveStatus } from '@rebel/masterchat'
import { ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import ExperienceService from '@rebel/server/services/ExperienceService'
import StatusService from '@rebel/server/services/StatusService'
import ChannelStore, { ChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { getLivestreamLink } from '@rebel/server/util/text'
import { GET, Path, QueryParam } from 'typescript-rest'
import { zip } from '@rebel/server/util/arrays'
import { channelInfoAndLevelToPublicUser } from '@rebel/server/models/user'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

type GetStatusResponse = ApiResponse<1, {
  livestreamStatus: PublicLivestreamStatus
  apiStatus: PublicApiStatus
}>

type GetEventsResponse = ApiResponse<2, {
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  events: PublicChatMateEvent[]
}>

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
    const builder = this.registerResponseBuilder<GetStatusResponse>('status', 1)
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
    const builder = this.registerResponseBuilder<GetEventsResponse>('events', 2)
    if (since == null) {
      return builder.failure(400, `A value for 'since' must be provided.`)
    }

    try {
      const diffs = await this.experienceService.getLevelDiffs(since + 1)
      const channelInfo = await Promise.all(diffs.map(d => this.channelStore.getCurrent(d.channelId))) as ChannelWithLatestInfo[]
      const levelInfo = await Promise.all(diffs.map(d => this.experienceService.getLevel(d.channelId)))
      const channels = zip(channelInfo, levelInfo)

      let events: PublicChatMateEvent[] = []
      for (let i = 0; i < diffs.length; i++) {
        const diff = diffs[i]
        const user: PublicUser = channelInfoAndLevelToPublicUser(channels[i])

        events.push({
          schema: 1,
          type: 'levelUp',
          timestamp: diff.timestamp,
          data: {
            schema: 1,
            newLevel: diff.endLevel.level,
            oldLevel: diff.startLevel.level,
            user
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

  private async getLivestreamStatus (): Promise<PublicLivestreamStatus> {
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
      schema: 1,
      startTime: livestream.start?.getTime() ?? null,
      endTime: livestream.end?.getTime() ?? null,
      liveViewers: viewers?.viewCount ?? null,
      livestreamLink: link,
      status
    }
  }
}
