import { In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { GetEventsEndpoint, GetMasterchatAuthenticationEndpoint, GetStatusEndpoint, IChatMateController, SetActiveLivestreamEndpoint } from '@rebel/server/controllers/ChatMateController'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import { chooseWeightedRandom, pickRandom, randomInt, randomString } from '@rebel/server/util/random'
import { addTime } from '@rebel/server/util/datetime'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { ChatMateControllerDeps } from '@rebel/server/controllers/ChatMateControllerReal'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { userDataToPublicUser } from '@rebel/server/models/user'
import { Level } from '@rebel/server/services/ExperienceService'
import { asGte, asLt } from '@rebel/server/util/math'
import ChannelService from '@rebel/server/services/ChannelService'
import { getLiveId, getLivestreamLink } from '@rebel/server/util/text'
import { promised } from '@rebel/server/_test/utils'
import RankStore from '@rebel/server/stores/RankStore'
import { single } from '@rebel/server/util/arrays'

export default class ChatMateControllerFake implements IChatMateController {
  private channelService: ChannelService
  private rankStore: RankStore

  private liveId: string | null = 'CkOgjC9wjog'

  constructor (deps: ChatMateControllerDeps) {
    this.channelService = deps.resolve('channelService')
    this.rankStore = deps.resolve('rankStore')
  }

  public getStatus (args: In<GetStatusEndpoint>): Out<GetStatusEndpoint> {
    const { builder } = args

    const status: 'not_started' | 'live' | 'finished' = chooseWeightedRandom(['not_started', 1], ['live', 10], ['finished', 1])
    const livestreamStatus: PublicLivestreamStatus | null = this.liveId == null ? null : {
      schema: 3,
      livestream: {
        schema: 1,
        id: 1,
        livestreamLink: getLivestreamLink(this.liveId),
        status,
        startTime: status === 'not_started' ? null : addTime(new Date(), 'minutes', -10).getTime(),
        endTime: status === 'finished' ? addTime(new Date(), 'minutes', -5).getTime() : null,
      },
      youtubeLiveViewers: Math.round(Math.random() * 25),
      twitchLiveViewers: Math.round(Math.random() * 25),
    }

    const youtubeApiStatus: PublicApiStatus = {
      schema: 1,
      avgRoundtrip: 100,
      lastOk: new Date().getTime(),
      status: chooseWeightedRandom(['ok', 10], ['error', 1])
    }
    const twitchApiStatus: PublicApiStatus = {
      schema: 1,
      avgRoundtrip: 100,
      lastOk: new Date().getTime(),
      status: chooseWeightedRandom(['ok', 10], ['error', 1])
    }

    return new Promise(r => r(builder.success({ livestreamStatus, youtubeApiStatus, twitchApiStatus })))
  }

  public async getEvents (args: In<GetEventsEndpoint>): Out<GetEventsEndpoint> {
    const { builder, since } = args
    const users = await this.channelService.getActiveUserChannels('all')

    let events: PublicChatMateEvent[] = []
    const N = Math.sqrt(Math.random() * 100) - 5
    for (let i = 0; i < N; i++) {
      const r = Math.random()
      if (r < 0.7) {
        // level up event
        const newLevel = randomInt(0, 101)
        const level: Level = {
          level: asGte(newLevel, 0),
          levelProgress: asLt(asGte(Math.random(), 0), 1),
          totalExperience: asGte(randomInt(0, 100000), 0)
        }
        const userChannel = pickRandom(users)
        const ranks = single(await this.rankStore.getUserRanks([userChannel.userId])).ranks
        const user: PublicUser = userDataToPublicUser({ ...userChannel, userId: userChannel.userId, level, ranks })

        events.push({
          schema: 5,
          timestamp: new Date().getTime(),
          type: 'levelUp',
          levelUpData: {
            schema: 3,
            newLevel: newLevel,
            oldLevel: newLevel - 1,
            user
          },
          newTwitchFollowerData: null,
          donationData: null
        })
      } else if (r < 0.85) {
        // new follower event
        events.push({
          schema: 5,
          timestamp: new Date().getTime(),
          type: 'newTwitchFollower',
          levelUpData: null,
          newTwitchFollowerData: {
            schema: 1,
            displayName: randomString(8)
          },
          donationData: null
        })
      } else {
        // new donation
        const amount = randomInt(100, 10000) / 100
        events.push({
          schema: 5,
          timestamp: new Date().getTime(),
          type: 'donation',
          levelUpData: null,
          newTwitchFollowerData: null,
          donationData: {
            schema: 1,
            amount: amount,
            formattedAmount: `$${amount.toFixed(2)}`,
            currency: 'USD',
            id: 1,
            message: randomString(128),
            name: randomString(64),
            time: new Date().getTime(),
            linkedUser: null
          }
        })
      }
    }

    return builder.success({
      reusableTimestamp: events.at(-1)?.timestamp ?? since,
      events
    })
  }

  // eslint-disable-next-line @typescript-eslint/require-await
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

    if (this.liveId == null && liveId != null) {
      this.liveId = liveId
    } else if (this.liveId != null && liveId == null) {
      this.liveId = null
    } else if (!(this.liveId == null && liveId == null || this.liveId! === liveId)) {
      return args.builder.failure(422, `Cannot set active livestream ${liveId} because another livestream is already active.`)
    }

    return args.builder.success({ livestreamLink: this.liveId == null ? null : getLivestreamLink(this.liveId) })
  }

  public getMasterchatAuthentication (args: In<GetMasterchatAuthenticationEndpoint>): Out<GetMasterchatAuthenticationEndpoint> {
    return promised(args.builder.success({
      authenticated: true
    }))
  }
}
