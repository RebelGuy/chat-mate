import { GetChatEndpoint, IChatController } from '@rebel/server/controllers/ChatController'
import { buildPath, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ChatStore from '@rebel/server/stores/ChatStore'
import { unique } from '@rebel/server/util/arrays'
import { Path } from 'typescript-rest'

export type ChatControllerDeps = ControllerDependencies<{
  chatStore: ChatStore,
  experienceService: ExperienceService
}>

@Path(buildPath('chat'))
export default class ChatControllerReal implements IChatController {
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService

  constructor (deps: ChatControllerDeps) {
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
  }

  public async getChat (args: In<GetChatEndpoint>): Out<GetChatEndpoint> {
    let { builder, limit, since } = args
    since = since ?? 0
    const items = await this.chatStore.getChatSince(since, limit)
    const levelData = await this.getLevelData(items.map(c => c.channel.id))
    
    let chatItems: PublicChatItem[] = []
    for (const chat of items) {
      const level = levelData.get(chat.channel.id)!
      chatItems.push(chatAndLevelToPublicChatItem(chat, level))
    }

    return builder.success({
      reusableTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: chatItems
    })
  }

  private async getLevelData (channelIds: number[]): Promise<Map<number, LevelData>> {
    const uniqueIds = unique(channelIds)

    // since this is only a fetch request, we can run everything in parallel safely
    const promises = uniqueIds.map(id => this.experienceService.getLevel(id))
    const results = await Promise.all(promises)

    const map: Map<number, LevelData> = new Map(
      results.map((lv, i) => [uniqueIds[i], { level: lv.level, levelProgress: lv.levelProgress }])
    )
    return map
  }
}
