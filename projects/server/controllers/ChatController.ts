import { ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { privateToPublicItems } from '@rebel/server/models/chat'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ChatStore from '@rebel/server/stores/ChatStore'
import { unique } from '@rebel/server/util/arrays'
import { GET, Path, QueryParam } from 'typescript-rest'

type GetChatResponse = ApiResponse<5, {
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  chat: PublicChatItem[]
}>

type Deps = ControllerDependencies<{
  chatStore: ChatStore,
  experienceService: ExperienceService
}>

@Path(buildPath('chat'))
export default class ChatController extends ControllerBase {
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService

  constructor (deps: Deps) {
    super(deps, 'chat')
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
  }

  @GET
  public async getChat (
    // unix timestamp (milliseconds)
    @QueryParam('since') since?: number,
    @QueryParam('limit') limit?: number
  ): Promise<GetChatResponse> {
    const builder = this.registerResponseBuilder<GetChatResponse>('', 5)
    try {
      since = since ?? 0
      const items = await this.chatStore.getChatSince(since, limit)
      const levelData = await this.getLevelData(items.map(c => c.channel.id))

      return builder.success({
        reusableTimestamp: items.at(-1)?.time.getTime() ?? since,
        chat: privateToPublicItems(items, levelData)
      })
    } catch (e: any) {
      return builder.failure(e.message)
    }
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
