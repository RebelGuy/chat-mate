import { ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService, { RankedEntry } from '@rebel/server/services/ExperienceService'
import { ChannelName } from '@rebel/server/stores/ChannelStore'
import { GET, Path, QueryParam } from 'typescript-rest'

type GetLeaderboardResponse = ApiResponse<1, {
  entries: RankedEntry[]
}>

type GetRankResponse = ApiResponse<1, {
  relevantIndex: number
  entries: RankedEntry[]
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
  @Path('/leaderboard')
  public async getLeaderboard (): Promise<GetLeaderboardResponse> {
    const builder = this.registerResponseBuilder('leaderboard', 1)
    try {
      const leaderboard = await this.experienceService.getLeaderboard()
      return builder.success({ entries: leaderboard })
    } catch (e: any) {
      return builder.failure(e.message)
    }
  }

  @GET
  @Path('/rank')
  public async getRank (
    @QueryParam('name') name?: string,
    @QueryParam('id') id?: number
  ): Promise<GetRankResponse> {
    const builder = this.registerResponseBuilder('rank', 1)
    if (name == null && id == null) {
      return builder.failure(400, `A value for 'name' or 'id' must be provided.`)
    }

    try {
      let channel: ChannelName | null
      if (name != null) {
        channel = await this.channelService.getChannelByName(decodeURI(name).trim().toLowerCase())
        if (channel == null) {
          return builder.failure(404, `Could not find a channel matching name '${name}'`)
        }
      } else {
        channel = await this.channelService.getChannelById(id!)
        if (channel == null) {
          return builder.failure(404, `Could not find a channel matching id '${id}'`)
        }
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

      return builder.success({
        relevantIndex: prunedLeaderboard.findIndex(l => l === match),
        entries: prunedLeaderboard
      })
    } catch (e: any) {
      return builder.failure(e.message)
    }
  }
}
