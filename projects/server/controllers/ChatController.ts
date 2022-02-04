import { Dependencies } from '@rebel/server/context/context'
import { buildPath } from '@rebel/server/controllers/BaseEndpoint'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { privateToPublicItems, PublicChatItem } from '@rebel/server/models/chat'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ApiSchema } from '@rebel/server/types'
import { unique } from '@rebel/server/util/arrays'
import { GET, Path, QueryParam } from 'typescript-rest'

type GetChatResponse = ApiSchema<4, {
  liveId: string

  // include the timestamp so it can easily be used for the next request
  lastTimestamp: number

  chat: PublicChatItem[]
}>

type Deps = Dependencies<{
  liveId: string,
  chatStore: ChatStore,
  experienceService: ExperienceService
}>

@Path(buildPath('chat'))
export class ChatController {
  readonly liveId: string
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService

  constructor (dependencies: Deps) {
    this.liveId = dependencies.resolve('liveId')
    this.chatStore = dependencies.resolve('chatStore')
    this.experienceService = dependencies.resolve('experienceService')
  }

  @GET
  public async getChat (
    // unix timestamp (milliseconds)
    @QueryParam('since') since?: number,
    @QueryParam('limit') limit?: number
  ): Promise<GetChatResponse> {
    since = since ?? 0
    const items = await this.chatStore.getChatSince(since, limit)
    const levelData = await this.getLevelData(items.map(c => c.channel.youtubeId))

    return {
      schema: 4,
      liveId: this.liveId,
      lastTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: privateToPublicItems(items, levelData)
    }
  }

  private async getLevelData (channelIds: string[]): Promise<Map<string, LevelData>> {
    const uniqueIds = unique(channelIds)

    // since this is only a fetch request, we can run everything in parallel safely
    const promises = uniqueIds.map(id => this.experienceService.getLevel(id))
    const results = await Promise.all(promises)

    const map: Map<string, LevelData> = new Map(
      results.map((lv, i) => [uniqueIds[i], { level: lv.level, levelProgress: lv.levelProgress }])
    )
    return map
  }
}
