import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { rankedEntryToPublic } from '@rebel/server/models/experience'
import { punishmentToPublicObject } from '@rebel/server/models/punishment'
import { userChannelAndLevelToPublicUser } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import PunishmentService from '@rebel/server/services/PunishmentService'
import { GET, Path, POST, QueryParam } from 'typescript-rest'

type GetLeaderboardResponse = ApiResponse<3, {
  rankedUsers: Tagged<2, PublicRankedUser>[]
}>

type GetRankResponse = ApiResponse<3, {
  relevantIndex: number
  rankedUsers: Tagged<2, PublicRankedUser>[]
}>

type ModifyExperienceRequest = ApiRequest<2, {
  schema: 2,
  userId: number,
  deltaLevels: number,
  message: string | null
}>

type ModifyExperienceResponse = ApiResponse<2, {
  updatedUser: Tagged<2, PublicUser>
}>

type Deps = ControllerDependencies<{
  channelService: ChannelService
  experienceService: ExperienceService
  punishmentService: PunishmentService
}>

@Path(buildPath('experience'))
export default class ExperienceController extends ControllerBase {
  private readonly channelService: ChannelService
  private readonly experienceService: ExperienceService
  private readonly punishmentService: PunishmentService

  constructor (deps: Deps) {
    super(deps, 'experience')
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
    this.punishmentService = deps.resolve('punishmentService')
  }

  @GET
  @Path('leaderboard')
  public async getLeaderboard (): Promise<GetLeaderboardResponse> {
    const builder = this.registerResponseBuilder<GetLeaderboardResponse>('GET /leaderboard', 3)
    try {
      const leaderboard = await this.experienceService.getLeaderboard()
      const activePunishments = await this.punishmentService.getCurrentPunishments()
      const publicLeaderboard = leaderboard.map(entry => {
        const userPunishments = activePunishments.filter(p => p.userId === entry.userId).map(punishmentToPublicObject)
        return rankedEntryToPublic(entry, userPunishments)
      })
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
    const builder = this.registerResponseBuilder<GetRankResponse>('GET /rank', 3)
    if (id == null) {
      return builder.failure(400, `A value for 'name' or 'id' must be provided.`)
    }

    try {
      let user = await this.channelService.getActiveUserChannel(id)
      if (user == null) {
        return builder.failure(404, `Could not find a user matching id '${id}'`)
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
      const activePunishments = await this.punishmentService.getCurrentPunishments()
      const publicLeaderboard = prunedLeaderboard.map(entry => {
        const userPunishments = activePunishments.filter(p => p.userId === entry.userId).map(punishmentToPublicObject)
        return rankedEntryToPublic(entry, userPunishments)
      })

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
    const builder = this.registerResponseBuilder<ModifyExperienceResponse>('POST /modify', 2)
    if (request == null || request.schema !== builder.schema) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const user = await this.channelService.getActiveUserChannel(request.userId)
      if (user == null) {
        return builder.failure(404, 'Cannot find user.')
      }

      const level = await this.experienceService.modifyExperience(request.userId, request.deltaLevels, request.message)
      const activePunishments = await this.punishmentService.getCurrentPunishments()
      const userPunishments = activePunishments.filter(p => p.userId === request.userId).map(punishmentToPublicObject)
      const publicUser = userChannelAndLevelToPublicUser({ ...user, ...level }, userPunishments)
      return builder.success({ updatedUser: publicUser })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
