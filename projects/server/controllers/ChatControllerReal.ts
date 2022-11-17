import ApiService from '@rebel/server/controllers/ApiService'
import { GetChatEndpoint, IChatController } from '@rebel/server/controllers/ChatController'
import { buildPath, ControllerBase, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore from '@rebel/server/stores/RankStore'
import { unique } from '@rebel/server/util/arrays'
import { Path } from 'typescript-rest'

export type ChatControllerDeps = ControllerDependencies<{
  chatStore: ChatStore,
  experienceService: ExperienceService
  rankStore: RankStore
}>

@Path(buildPath('chat'))
export default class ChatControllerReal extends ControllerBase implements IChatController {
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService
  readonly rankStore: RankStore

  constructor (deps: ChatControllerDeps) {
    super(deps, '/chat')
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
  }

  public async getChat (args: In<GetChatEndpoint>): Out<GetChatEndpoint> {
    let { builder, limit, since } = args
    since = since ?? 0
    const items = await this.chatStore.getChatSince(since, limit)
    const userIds = unique(items.map(c => c.userId))
    if (userIds.find(id => id == null) != null) {
      throw new Error('Chat items must have a userId set')
    }

    const levels = await this.experienceService.getLevels(this.getStreamerId(), userIds as number[])
    const ranks = await this.rankStore.getUserRanks(userIds as number[], this.getStreamerId())

    let chatItems: PublicChatItem[] = []
    for (const chat of items) {
      const level = levels.find(l => l.userId === chat.userId)!.level
      const activeRanks = ranks.find(r => r.userId === chat.userId)!.ranks.map(userRankToPublicObject)
      chatItems.push(chatAndLevelToPublicChatItem(chat, level, activeRanks))
    }

    return builder.success({
      reusableTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: chatItems
    })
  }
}
