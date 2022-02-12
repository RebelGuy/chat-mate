import { Dependencies } from '@rebel/server/context/context'
import { buildPath } from '@rebel/server/controllers/BaseEndpoint'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService, { RankedEntry } from '@rebel/server/services/ExperienceService'
import { ApiSchema } from '@rebel/server/types'
import { GET, Path, QueryParam } from 'typescript-rest'

type GetLeaderboardResponse = ApiSchema<1, {
  // the timestamp at which this response was generated.
  timestamp: number
  entries: RankedEntry[]
}>

type GetRankResponse = ApiSchema<1, {
  // the timestamp at which this response was generated.
  timestamp: number

  relevantIndex: number

  // empty if `channelFound` is false
  entries: RankedEntry[]
}>

type Deps = Dependencies<{
  channelService: ChannelService
  experienceService: ExperienceService
}>

@Path(buildPath('experience'))
export class ExperienceController {
  private readonly channelService: ChannelService
  private readonly experienceService: ExperienceService

  constructor (dependencies: Deps) {
    this.channelService = dependencies.resolve('channelService')
    this.experienceService = dependencies.resolve('experienceService')
  }

  @GET
  @Path('/leaderboard')
  public async getLeaderboard (): Promise<GetLeaderboardResponse> {
    const leaderboard = await this.experienceService.getLeaderboard()

    return {
      schema: 1,
      timestamp: new Date().getTime(),
      entries: leaderboard
    }
  }

  @GET
  @Path('/rank')
  public async getRank (
    @QueryParam('name') name: string
  ): Promise<GetRankResponse> {
    name = decodeURI(name).trim().toLowerCase()
    const channel = await this.channelService.getChannelByName(name)

    const emptyResponse: GetRankResponse = {
      schema: 1,
      timestamp: new Date().getTime(),
      relevantIndex: -1,
      entries: []
    }
    if (channel == null) {
      return emptyResponse
    }

    const leaderboard = await this.experienceService.getLeaderboard()
    const match = leaderboard.find(l => l.channelName.toLowerCase() === name)
    if (match == null) {
      return emptyResponse
    }

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

    return {
      schema: 1,
      timestamp: new Date().getTime(),
      relevantIndex: prunedLeaderboard.findIndex(l => l === match),
      entries: prunedLeaderboard
    }
  }
}
