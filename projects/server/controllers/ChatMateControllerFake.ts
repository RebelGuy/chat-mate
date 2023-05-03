import { ControllerBase, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { GetChatMateRegisteredUsernameEndpoint, GetEventsEndpoint, GetMasterchatAuthenticationEndpoint, GetStatusEndpoint, IChatMateController, SetActiveLivestreamEndpoint } from '@rebel/server/controllers/ChatMateController'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import { chooseWeightedRandom, pickRandom, randomInt, randomString } from '@rebel/shared/util/random'
import { addTime } from '@rebel/shared/util/datetime'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { ChatMateControllerDeps } from '@rebel/server/controllers/ChatMateControllerReal'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { userDataToPublicUser } from '@rebel/server/models/user'
import { UserLevel } from '@rebel/server/services/ExperienceService'
import { asGte, asLt } from '@rebel/shared/util/math'
import ChannelService from '@rebel/server/services/ChannelService'
import { getLiveId, getLivestreamLink } from '@rebel/shared/util/text'
import { cast, promised } from '@rebel/server/_test/utils'
import RankStore from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import AccountService, { getPrimaryUserId } from '@rebel/server/services/AccountService'
import { RegisteredUser } from '@prisma/client'

export default class ChatMateControllerFake extends ControllerBase implements IChatMateController {
  private channelService: ChannelService
  private rankStore: RankStore
  private accountService: AccountService

  private liveId: string | null = 'CkOgjC9wjog'

  constructor (deps: ChatMateControllerDeps) {
    super(deps, '/chatMate')
    this.channelService = deps.resolve('channelService')
    this.rankStore = deps.resolve('rankStore')
    this.accountService = deps.resolve('accountService')
  }

  public getStatus (args: In<GetStatusEndpoint>): Out<GetStatusEndpoint> {
    const { builder } = args

    const status: 'not_started' | 'live' | 'finished' = chooseWeightedRandom(['not_started', 1], ['live', 10], ['finished', 1])
    const livestreamStatus: PublicLivestreamStatus | null = this.liveId == null ? null : {
      livestream: {
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
      avgRoundtrip: 100,
      lastOk: new Date().getTime(),
      status: chooseWeightedRandom(['ok', 10], ['error', 1])
    }
    const twitchApiStatus: PublicApiStatus = {
      avgRoundtrip: 100,
      lastOk: new Date().getTime(),
      status: chooseWeightedRandom(['ok', 10], ['error', 1])
    }

    return new Promise(r => r(builder.success({ livestreamStatus, youtubeApiStatus, twitchApiStatus })))
  }

  public async getEvents (args: In<GetEventsEndpoint>): Out<GetEventsEndpoint> {
    const { builder, since } = args
    const primaryUserIds = await this.accountService.getStreamerPrimaryUserIds(this.getStreamerId())
    const users = await this.channelService.getActiveUserChannels(this.getStreamerId(), primaryUserIds)

    let events: PublicChatMateEvent[] = []
    const N = Math.sqrt(Math.random() * 100) - 5
    for (let i = 0; i < N; i++) {
      const r = Math.random()
      if (r < 0.7) {
        // level up event
        const newLevel = randomInt(0, 101)
        const userChannel = pickRandom(users)
        const primaryUserId = getPrimaryUserId(userChannel)
        const ranks = single(await this.rankStore.getUserRanks([primaryUserId], this.getStreamerId()))
        const level: UserLevel = {
          primaryUserId: primaryUserId,
          level: {
            level: asGte(newLevel, 0),
            levelProgress: asLt(asGte(Math.random(), 0), 1),
            totalExperience: asGte(randomInt(0, 100000), 0)
          }
        }
        const registeredUser = userChannel.aggregateUserId == null ? null : cast<RegisteredUser>({ aggregateChatUserId: userChannel.aggregateUserId!, username: 'test username' })
        const user: PublicUser = userDataToPublicUser({ ...userChannel, ...level, ...ranks, ...{ registeredUser } })

        events.push({
          timestamp: new Date().getTime(),
          type: 'levelUp',
          levelUpData: {
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
          timestamp: new Date().getTime(),
          type: 'newTwitchFollower',
          levelUpData: null,
          newTwitchFollowerData: {
            displayName: randomString(8)
          },
          donationData: null
        })
      } else {
        // new donation
        const amount = randomInt(100, 10000) / 100
        events.push({
          timestamp: new Date().getTime(),
          type: 'donation',
          levelUpData: null,
          newTwitchFollowerData: null,
          donationData: {
            amount: amount,
            formattedAmount: `$${amount.toFixed(2)}`,
            currency: 'USD',
            id: 1,
            messageParts: [{
              type: 'text',
              textData: {
                text: randomString(128),
                isBold: false,
                isItalics: false
              },
              cheerData: null,
              customEmojiData: null,
              emojiData: null
            }],
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

  public getChatMateRegisteredUsername (args: In<GetChatMateRegisteredUsernameEndpoint>): Out<GetChatMateRegisteredUsernameEndpoint> {
    return promised(args.builder.success({ username: 'chatmate' }))
  }
}
