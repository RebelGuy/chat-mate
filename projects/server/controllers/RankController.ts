import { Dependencies } from '@rebel/server/context/context'
import { ApiRequest, ApiResponse, buildPath, ControllerBase, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicChannelRankChange } from '@rebel/server/controllers/public/rank/PublicChannelRankChange'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import LogService from '@rebel/server/services/LogService'
import ModService, { TwitchModResult, YoutubeModResult } from '@rebel/server/services/rank/ModService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { DELETE, Path, POST } from 'typescript-rest'

type AddModRankRequest = ApiRequest<1, {
  schema: 1,
  userId: number,
  message: string | null
}>
type AddModRankResponse = ApiResponse<1, {
  newRank: Tagged<1, PublicUserRank> | null
  newRankError: string | null
  channelModChanges: Tagged<1, PublicChannelRankChange>[]
}>

type RemoveModRankRequest = ApiRequest<1, {
  schema: 1,
  userId: number,
  message: string | null
}>
type RemoveModRankResponse = ApiResponse<1, {
  removedRank: Tagged<1, PublicUserRank> | null
  removedRankError: string | null
  channelModChanges: Tagged<1, PublicChannelRankChange>[]
}>

type Deps = Dependencies<{
  logService: LogService
  channelStore: ChannelStore
  modService: ModService
}>

@Path(buildPath('rank'))
export default class PunishmentController extends ControllerBase {
  private readonly modService: ModService
  private readonly channelStore: ChannelStore

  constructor (deps: Deps) {
    super(deps, 'rank')
    this.modService = deps.resolve('modService')
    this.channelStore = deps.resolve('channelStore')
  }

  @POST
  @Path('/mod')
  public async addModRank (request: AddModRankRequest): Promise<AddModRankResponse> {
    const builder = this.registerResponseBuilder<AddModRankResponse>('POST /mod', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.modService.setModRank(request.userId, true, request.message)
      return builder.success({
        newRank: result.rankResult.rank ==  null ? null : userRankToPublicObject(result.rankResult.rank),
        newRankError: result.rankResult.error,
        channelModChanges: await this.getChannelRankChanges(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @DELETE
  @Path('/mod')
  public async removeModRank (request: RemoveModRankRequest): Promise<RemoveModRankResponse> {
    const builder = this.registerResponseBuilder<RemoveModRankResponse>('DELETE /mod', 1)
    if (request == null || request.schema !== builder.schema || request.userId == null) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const result = await this.modService.setModRank(request.userId, false, request.message)
      return builder.success({
        removedRank: result.rankResult.rank ==  null ? null : userRankToPublicObject(result.rankResult.rank),
        removedRankError: result.rankResult.error,
        channelModChanges: await this.getChannelRankChanges(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  private async getChannelRankChanges (results: { youtubeResults: YoutubeModResult[], twitchResults: TwitchModResult[] }): Promise<PublicChannelRankChange[]> {
    const makePublicResult = async (channelId: number, platform: 'youtube' | 'twitch', error: string | null): Promise<PublicChannelRankChange> => {
      let channelName: string
      if (platform === 'youtube') {
        channelName = await this.channelStore.getYoutubeChannelNameFromChannelId(channelId)
      } else if (platform === 'twitch') {
        channelName = await this.channelStore.getTwitchUserNameFromChannelId(channelId)
      } else {
        assertUnreachable(platform)
      }
      
      return {
        schema: 1,
        channelId,
        platform,
        error,
        channelName
      }
    }
    
    return await Promise.all([
      ...results.youtubeResults.map(c => makePublicResult(c.youtubeChannelId, 'youtube', c.error)),
      ...results.twitchResults.map(c => makePublicResult(c.twitchChannelId, 'twitch', c.error))
    ])
  }
}
