import { GetChatEndpoint, IChatController } from '@rebel/server/controllers/ChatController'
import { buildPath, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { punishmentToPublicObject } from '@rebel/server/models/punishment'
import ExperienceService from '@rebel/server/services/ExperienceService'
import PunishmentService from '@rebel/server/services/PunishmentService'
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
    const levelData = await this.getLevelData(items.map(c => c.userId))
    
    let chatItems: PublicChatItem[] = []
    for (const chat of items) {
      const level = levelData.get(chat.userId)!
      const punishments = (await this.punishmentService.getCurrentPunishments())
        .filter(p => p.userId === chat.userId)
        .map(punishmentToPublicObject)
      chatItems.push(chatAndLevelToPublicChatItem(chat, level, punishments))
    }

    return builder.success({
      reusableTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: chatItems
    })
  }

  private async getLevelData (userIds: number[]): Promise<Map<number, LevelData>> {
    const uniqueIds = unique(userIds)

    // since this is only a fetch request, we can run everything in parallel safely
    const promises = uniqueIds.map(id => this.experienceService.getLevel(id))
    const results = await Promise.all(promises)

    const map: Map<number, LevelData> = new Map(
      results.map((lv, i) => [uniqueIds[i], { level: lv.level, levelProgress: lv.levelProgress }])
    )
    return map
  }
}
