import { GetChatEndpoint, IChatController } from '@rebel/server/controllers/ChatController'
import { buildPath, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import ExperienceService from '@rebel/server/services/ExperienceService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import ChatStore from '@rebel/server/stores/ChatStore'
import { unique } from '@rebel/server/util/arrays'
import { Path } from 'typescript-rest'

export type ChatControllerDeps = ControllerDependencies<{
  chatStore: ChatStore,
  experienceService: ExperienceService
  punishmentService: PunishmentService
}>

@Path(buildPath('chat'))
export default class ChatControllerReal implements IChatController {
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService
  readonly punishmentService: PunishmentService

  constructor (deps: ChatControllerDeps) {
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
    this.punishmentService = deps.resolve('punishmentService')
  }

  public async getChat (args: In<GetChatEndpoint>): Out<GetChatEndpoint> {
    let { builder, limit, since } = args
    since = since ?? 0
    const items = await this.chatStore.getChatSince(since, limit)
    const userIds = unique(items.map(c => c.userId))
    const levels = await this.experienceService.getLevels(userIds)

    let chatItems: PublicChatItem[] = []
    for (const chat of items) {
      const level = levels.find(l => l.userId === chat.userId)!.level
      const punishments = (await this.punishmentService.getCurrentPunishments())
        .filter(p => p.userId === chat.userId)
        .map(userRankToPublicObject)
      chatItems.push(chatAndLevelToPublicChatItem(chat, level, punishments))
    }

    return builder.success({
      reusableTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: chatItems
    })
  }
}
