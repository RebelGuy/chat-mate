import { LiveStatus } from '@rebel/masterchat'
import { ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import ExperienceService from '@rebel/server/services/ExperienceService'
import StatusService from '@rebel/server/services/StatusService'
import ChannelStore, { ChannelWithLatestInfo, UserChannel } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { getLivestreamLink } from '@rebel/server/util/text'
import { nonNull, zip } from '@rebel/server/util/arrays'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { GetEventsEndpoint, GetStatusEndpoint, IChatMateController } from '@rebel/server/controllers/ChatMateController'
import ChannelService from '@rebel/server/services/ChannelService'
import { userChannelAndLevelToPublicUser } from '@rebel/server/models/user'

export type ChatMateControllerDeps = ControllerDependencies<{
  livestreamStore: LivestreamStore
  viewershipStore: ViewershipStore
  masterchatStatusService: StatusService
  twurpleStatusService: StatusService
  experienceService: ExperienceService
  channelService: ChannelService
}>

export default class ChatMateControllerReal implements IChatMateController {
  readonly livestreamStore: LivestreamStore
  readonly viewershipStore: ViewershipStore
  readonly masterchatStatusService: StatusService
  readonly twurpleStatusService: StatusService
  readonly experienceService: ExperienceService
  readonly channelService: ChannelService

  constructor (deps: ChatMateControllerDeps) {
    this.livestreamStore = deps.resolve('livestreamStore')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.masterchatStatusService = deps.resolve('masterchatStatusService')
    this.twurpleStatusService = deps.resolve('twurpleStatusService')
    this.experienceService = deps.resolve('experienceService')
    this.channelService = deps.resolve('channelService')
  }

  public async getStatus (args: In<GetStatusEndpoint>): Out<GetStatusEndpoint> {
    const { builder } = args
    const livestreamStatus = await this.getLivestreamStatus()
    const youtubeApiStatus = this.masterchatStatusService.getApiStatus()
    const twitchApiStatus = this.twurpleStatusService.getApiStatus()

    return builder.success({ livestreamStatus, youtubeApiStatus, twitchApiStatus })
  }

  public async getEvents (args: In<GetEventsEndpoint>): Out<GetEventsEndpoint> {
    const { builder, since } = args

    const diffs = await this.experienceService.getLevelDiffs(since + 1)

    const userChannels = nonNull(await Promise.all(diffs.map(d => this.channelService.getActiveUserChannel(d.userId))))
    const levelInfo = await Promise.all(diffs.map(d => this.experienceService.getLevel(d.userId)))
    const channels = zip(userChannels, levelInfo)

    let events: PublicChatMateEvent[] = []
    for (let i = 0; i < diffs.length; i++) {
      const diff = diffs[i]
      const user: PublicUser = userChannelAndLevelToPublicUser(channels[i])

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
