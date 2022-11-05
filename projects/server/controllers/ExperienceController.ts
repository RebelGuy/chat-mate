import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { rankedEntryToPublic } from '@rebel/server/models/experience'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { userDataToPublicUser } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import RankStore from '@rebel/server/stores/RankStore'
import { single, zipOnStrict } from '@rebel/server/util/arrays'
import { GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'

type GetLeaderboardResponse = ApiResponse<4, {
  rankedUsers: Tagged<3, PublicRankedUser>[]
}>

type GetRankResponse = ApiResponse<4, {
  relevantIndex: number
  rankedUsers: Tagged<3, PublicRankedUser>[]
}>

type ModifyExperienceRequest = ApiRequest<3, {
  schema: 3,
  userId: number,
  deltaLevels: number,
  message: string | null
}>

type ModifyExperienceResponse = ApiResponse<3, {
  updatedUser: Tagged<3, PublicUser>
}>

type Deps = ControllerDependencies<{
  channelService: ChannelService
  experienceService: ExperienceService
  punishmentService: PunishmentService
  rankStore: RankStore
}>

@Path(buildPath('experience'))
@PreProcessor(requireStreamer)
export default class ExperienceController extends ControllerBase {
  private readonly channelService: ChannelService
  private readonly experienceService: ExperienceService
  private readonly punishmentService: PunishmentService
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super(deps, 'experience')
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
    this.punishmentService = deps.resolve('punishmentService')
    this.rankStore = deps.resolve('rankStore')
  }

  @GET
  @Path('leaderboard')
  public async getLeaderboard (): Promise<GetLeaderboardResponse> {
    const builder = this.registerResponseBuilder<GetLeaderboardResponse>('GET /leaderboard', 4)
    try {
      const leaderboard = await this.experienceService.getLeaderboard()
      const activeRanks = await this.rankStore.getUserRanks(leaderboard.map(r => r.userId), this.getStreamerId())
      const publicLeaderboard = zipOnStrict(leaderboard, activeRanks, 'userId').map(rankedEntryToPublic)
      return builder.success({ rankedUsers: publicLeaderboard })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('rank')
  public async getRank (
    @QueryParam('id') id: number
  ): Promise<GetRankResponse> {
    const builder = this.registerResponseBuilder<GetRankResponse>('GET /rank', 4)
    if (id == null) {
      return builder.failure(400, `A value for 'name' or 'id' must be provided.`)
    }

    try {
      let userChannels = await this.channelService.getActiveUserChannels([id])
      if (userChannels.length == 0) {
        return builder.failure(404, `Could not find an active channel for user ${id}.`)
      }

      const leaderboard = await this.experienceService.getLeaderboard()
      const match = leaderboard.find(l => l.userId === id)!

      // always include a total of rankPadding * 2 + 1 entries, with the matched entry being centred where possible
      const rankPadding = 3
      let lowerRank: number
      if (match.rank > leaderboard.length - rankPadding) {
        lowerRank = leaderboard.length - rankPadding * 2
      } else if (match.rank < 1 + rankPadding) {
        lowerRank = 1
      } else {
        lowerRank = match.rank - rankPadding
      }
      const upperRank = lowerRank + rankPadding * 2
      const prunedLeaderboard = leaderboard.filter(l => l.rank >= lowerRank && l.rank <= upperRank)
      const activeRanks = await this.rankStore.getUserRanks(prunedLeaderboard.map(entry => entry.userId), this.getStreamerId())
      const publicLeaderboard = zipOnStrict(prunedLeaderboard, activeRanks, 'userId').map(rankedEntryToPublic)

      return builder.success({
        relevantIndex: prunedLeaderboard.findIndex(l => l === match),
        rankedUsers: publicLeaderboard
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('modify')
  public async modifyExperience (request: ModifyExperienceRequest): Promise<ModifyExperienceResponse> {
    const builder = this.registerResponseBuilder<ModifyExperienceResponse>('POST /modify', 3)
    if (request == null || request.schema !== builder.schema) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const userChannels = await this.channelService.getActiveUserChannels([request.userId])
      const userChannel = userChannels[0]
      if (userChannel == null) {
        return builder.failure(404, `Could not find an active channel for user ${request.userId}.`)
      }

      const level = await this.experienceService.modifyExperience(request.userId, this.getStreamerId()!, request.deltaLevels, request.message)
      const activeRanks = single(await this.rankStore.getUserRanks([request.userId], this.getStreamerId()))
      const publicUser = userDataToPublicUser({ ...userChannel, ...level, ...activeRanks })
      return builder.success({ updatedUser: publicUser })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
