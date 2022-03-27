import { In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { GetEventsEndpoint, GetStatusEndpoint, IChatMateController } from '@rebel/server/controllers/ChatMateController'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import { chooseWeightedRandom, pickRandom, randomInt } from '@rebel/server/util/random'
import { addTime } from '@rebel/server/util/datetime'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { ChatMateControllerDeps } from '@rebel/server/controllers/ChatMateControllerReal'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { userChannelAndLevelToPublicUser } from '@rebel/server/models/user'
import { Level } from '@rebel/server/services/ExperienceService'
import { asGte, asLt } from '@rebel/server/util/math'
import ChannelService from '@rebel/server/services/ChannelService'

export default class ChatMateControllerFake implements IChatMateController {
  private channelService: ChannelService

  constructor (deps: ChatMateControllerDeps) {
    this.channelService = deps.resolve('channelService')
  }

  public getStatus (args: In<GetStatusEndpoint>): Out<GetStatusEndpoint> {
    const { builder } = args

    const status: 'not_started' | 'live' | 'finished' = chooseWeightedRandom(['not_started', 1], ['live', 10], ['finished', 1])
    const livestreamStatus: PublicLivestreamStatus = {
      schema: 1,
      startTime: status === 'not_started' ? null : addTime(new Date(), 'minutes', -10).getTime(),
      endTime: status === 'finished' ? addTime(new Date(), 'minutes', -5).getTime() : null,
      liveViewers: Math.round(Math.random() * 25),
      livestreamLink: 'www.test.com',
      status
    }

    const apiStatus: PublicApiStatus = {
      schema: 1,
      avgRoundtrip: 100,
      lastOk: new Date().getTime(),
      status: chooseWeightedRandom(['ok', 10], ['error', 1])
    }
    
    return new Promise(r => r(builder.success({ livestreamStatus, apiStatus })))
  }

  public async getEvents (args: In<GetEventsEndpoint>): Out<GetEventsEndpoint> {
    const { builder, since } = args
    const users = await this.channelService.getActiveUserChannels()

    let events: PublicChatMateEvent[] = []
    const N = Math.sqrt(Math.random() * 100) - 5
    for (let i = 0; i < N; i++) {
      const newLevel = randomInt(0, 101)
      const level: Level = {
        level: asGte(newLevel, 0),
        levelProgress: asLt(asGte(Math.random(), 0), 1),
        totalExperience: asGte(randomInt(0, 100000), 0)
      }
      const user: PublicUser = userChannelAndLevelToPublicUser({ ...pickRandom(users), ...level })

      events.push({
        schema: 1,
        timestamp: new Date().getTime(),
        type: 'levelUp',
        data: {
          schema: 1,
          newLevel: newLevel,
          oldLevel: newLevel - 1,
          user
        }
      })
    }

    return builder.success({
      reusableTimestamp: events.at(-1)?.timestamp ?? since,
      events
    })
  }
}
