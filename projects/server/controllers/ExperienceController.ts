import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { rankedEntryToPublic } from '@rebel/server/models/experience'
import { userAndLevelToPublicUser } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import { GET, Path, POST, QueryParam } from 'typescript-rest'

type GetLeaderboardResponse = ApiResponse<2, {
  rankedUsers: PublicRankedUser[]
}>

type GetRankResponse = ApiResponse<2, {
  relevantIndex: number
  rankedUsers: PublicRankedUser[]
}>

type ModifyExperienceRequest = ApiRequest<1, {
  schema: 1,
  userId: number,
  deltaLevels: number,
  message: string | null
}>

type ModifyExperienceResponse = ApiResponse<1, {
  updatedUser: PublicUser
}>

type Deps = ControllerDependencies<{
  channelService: ChannelService
  experienceService: ExperienceService
}>

@Path(buildPath('experience'))
export default class ExperienceController extends ControllerBase {
  private readonly channelService: ChannelService
  private readonly experienceService: ExperienceService

  constructor (deps: Deps) {
    super(deps, 'experience')
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
  }

  @GET
  @Path('leaderboard')
  public async getLeaderboard (): Promise<GetLeaderboardResponse> {
    const builder = this.registerResponseBuilder<GetLeaderboardResponse>('GET /leaderboard', 2)
    try {
      const leaderboard = await this.experienceService.getLeaderboard()
      const publicLeaderboard = leaderboard.map(entry => rankedEntryToPublic(entry))
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
    const builder = this.registerResponseBuilder<GetRankResponse>('GET /rank', 2)
    if (id == null) {
      return builder.failure(400, `A value for 'name' or 'id' must be provided.`)
    }

    try {
      let channel = await this.channelService.getChannelById(id)
      if (channel == null) {
        return builder.failure(404, `Could not find a channel matching id '${id}'`)
      }

      const leaderboard = await this.experienceService.getLeaderboard()
      const match = leaderboard.find(l => l.channelName === channel!.name)!

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
      const publicLeaderboard = prunedLeaderboard.map(entry => rankedEntryToPublic(entry))

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
    const builder = this.registerResponseBuilder<ModifyExperienceResponse>('POST /modify', 1)
    if (request == null || request.schema !== builder.schema) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const channel = await this.channelService.getChannelById(request.userId)
      if (channel == null) {
        return builder.failure(404, 'Cannot find channel.')
      }

      const level = await this.experienceService.modifyExperience(request.userId, request.deltaLevels, request.message)
      const publicUser = userAndLevelToPublicUser({ ...channel, ...level })
      return builder.success({ updatedUser: publicUser })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
