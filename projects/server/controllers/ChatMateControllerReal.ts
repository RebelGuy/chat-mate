import { LiveStatus } from '@rebel/masterchat'
import { ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import ExperienceService from '@rebel/server/services/ExperienceService'
import StatusService from '@rebel/server/services/StatusService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { getLiveId, getLivestreamLink } from '@rebel/server/util/text'
import { nonNull, zip, zipOnStrict, zipOnStrictMany } from '@rebel/server/util/arrays'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { GetEventsEndpoint, GetMasterchatAuthenticationEndpoint, GetStatusEndpoint, IChatMateController, SetActiveLivestreamEndpoint } from '@rebel/server/controllers/ChatMateController'
import ChannelService from '@rebel/server/services/ChannelService'
import { userDataToPublicUser } from '@rebel/server/models/user'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import LivestreamService from '@rebel/server/services/LivestreamService'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { promised } from '@rebel/server/_test/utils'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import RankStore from '@rebel/server/stores/RankStore'

export type ChatMateControllerDeps = ControllerDependencies<{
  livestreamStore: LivestreamStore
  viewershipStore: ViewershipStore
  masterchatStatusService: StatusService
  twurpleStatusService: StatusService
  experienceService: ExperienceService
  channelService: ChannelService
  followerStore: FollowerStore
  punishmentService: PunishmentService
  livestreamService: LivestreamService
  masterchatProxyService: MasterchatProxyService
  rankStore: RankStore
}>

export default class ChatMateControllerReal implements IChatMateController {
  readonly livestreamStore: LivestreamStore
  readonly viewershipStore: ViewershipStore
  readonly masterchatStatusService: StatusService
  readonly twurpleStatusService: StatusService
  readonly experienceService: ExperienceService
  readonly channelService: ChannelService
  readonly followerStore: FollowerStore
  readonly punishmentService: PunishmentService
  readonly livestreamService: LivestreamService
  readonly masterchatProxyService: MasterchatProxyService
  readonly rankStore: RankStore

  constructor (deps: ChatMateControllerDeps) {
    this.livestreamStore = deps.resolve('livestreamStore')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.masterchatStatusService = deps.resolve('masterchatStatusService')
    this.twurpleStatusService = deps.resolve('twurpleStatusService')
    this.experienceService = deps.resolve('experienceService')
    this.channelService = deps.resolve('channelService')
    this.followerStore = deps.resolve('followerStore')
    this.punishmentService = deps.resolve('punishmentService')
    this.livestreamService = deps.resolve('livestreamService')
    this.masterchatProxyService = deps.resolve('masterchatProxyService')
    this.rankStore = deps.resolve('rankStore')
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

    const userChannels = await this.channelService.getActiveUserChannels(diffs.map(d => d.userId))
    const levelInfo = await this.experienceService.getLevels(diffs.map(d => d.userId))
    const ranks = await this.rankStore.getUserRanks(diffs.map(d => d.userId))
    const userData = zipOnStrictMany(userChannels, 'userId', levelInfo, ranks)

    let events: PublicChatMateEvent[] = []
    for (let i = 0; i < diffs.length; i++) {
      const diff = diffs[i]
      const user: PublicUser = userDataToPublicUser(userData[i])

      events.push({
        schema: 4,
        type: 'levelUp',
        timestamp: diff.timestamp,
        levelUpData: {
          schema: 3,
          newLevel: diff.endLevel.level,
          oldLevel: diff.startLevel.level,
          user
        },
        newTwitchFollowerData: null
      })
    }

    const newFollowers = await this.followerStore.getFollowersSince(since + 1)
    for (let i = 0; i < newFollowers.length; i++) {
      const follower = newFollowers[i]
      events.push({
        schema: 4,
        type: 'newTwitchFollower',
        timestamp: follower.date.getTime(),
        levelUpData: null,
        newTwitchFollowerData: {
          schema: 1,
          displayName: follower.displayName
        }
      })
    }

    return builder.success({
      reusableTimestamp: events.at(-1)?.timestamp ?? since,
      events
    })
  }

  public async setActiveLivestream (args: In<SetActiveLivestreamEndpoint>): Out<SetActiveLivestreamEndpoint> {
    let liveId: string | null
    if (args.livestream == null) {
      liveId = null
    } else {
      try {
        liveId = getLiveId(args.livestream)
      } catch (e: any) {
        return args.builder.failure(400, `Cannot parse the liveId: ${e.message}`)
      }
    }

    if (this.livestreamStore.activeLivestream == null && liveId != null) {
      await this.livestreamService.setActiveLivestream(liveId)
    } else if (this.livestreamStore.activeLivestream != null && liveId == null) {
      await this.livestreamService.deactivateLivestream()
    } else if (!(this.livestreamStore.activeLivestream == null && liveId == null || this.livestreamStore.activeLivestream!.liveId === liveId)) {
      return args.builder.failure(422, `Cannot set active livestream ${liveId} because another livestream is already active.`)
    }

    const livestream = this.livestreamStore.activeLivestream
    return args.builder.success({ livestreamLink: livestream == null ? null : getLivestreamLink(livestream.liveId) })
  }

  public getMasterchatAuthentication (args: In<GetMasterchatAuthenticationEndpoint>): Out<GetMasterchatAuthenticationEndpoint> {
    return promised(args.builder.success({
      authenticated: this.masterchatProxyService.checkCredentials()
    }))
  }

  private async getLivestreamStatus (): Promise<PublicLivestreamStatus | null> {
    const livestream = this.livestreamStore.activeLivestream
    if (livestream == null) {
      return null
    }
    
    const link = getLivestreamLink(livestream.liveId)

    let viewers: { time: Date, viewCount: number, twitchViewCount: number } | null = null
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
      schema: 2,
      startTime: livestream.start?.getTime() ?? null,
      endTime: livestream.end?.getTime() ?? null,
      youtubeLiveViewers: viewers?.viewCount ?? null,
      twitchLiveViewers: viewers?.twitchViewCount ?? null,
      livestreamLink: link,
      status
    }
  }
}
