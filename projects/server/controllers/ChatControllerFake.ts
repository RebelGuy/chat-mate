import { GetChatEndpoint, IChatController } from '@rebel/server/controllers/ChatController'
import { ChatControllerDeps } from '@rebel/server/controllers/ChatControllerReal'
import { buildPath, ControllerBase, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { ChatItemWithRelations, chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore from '@rebel/server/stores/RankStore'
import { single } from '@rebel/server/util/arrays'
import { asGte, asLt } from '@rebel/server/util/math'
import { chooseWeightedRandom, randomInt } from '@rebel/server/util/random'
import { Path } from 'typescript-rest'

@Path(buildPath('chat'))
export default class ChatControllerFake extends ControllerBase implements IChatController {
  private readonly chatStore: ChatStore
  private readonly rankStore: RankStore

  private chat: ChatItemWithRelations[] | null = null

  constructor (deps: ChatControllerDeps) {
    super(deps, '/chat')
    this.chatStore = deps.resolve('chatStore')
    this.rankStore = deps.resolve('rankStore')
  }

  public async getChat (args: In<GetChatEndpoint>): Out<GetChatEndpoint> {
    let { builder, limit, since } = args
    since = since ?? 0

    if (this.chat == null) {
      this.chat = await this.chatStore.getChatSince(0)
    }

    const N = chooseWeightedRandom([0, 10], [1, 1], [2, 0.2])
    let items: PublicChatItem[] = []
    for (let i = 0; i < N; i++) {
      const item = this.chat[since % this.chat.length]
      since++

      const newLevel = randomInt(0, 101)
      const level: LevelData = {
        level: asGte(newLevel, 0),
        levelProgress: asLt(asGte(Math.random(), 0), 1)
      }
      const ranks = single(await this.rankStore.getUserRanks([item.userId!], this.getStreamerId())).ranks.map(userRankToPublicObject)
      items.push(chatAndLevelToPublicChatItem(item, level, ranks))
    }

    return builder.success({ reusableTimestamp: since, chat: items })
  }
}
