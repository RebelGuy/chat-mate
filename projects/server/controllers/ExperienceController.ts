import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { rankedEntryToPublic } from '@rebel/server/models/experience'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { userDataToPublicUser } from '@rebel/server/models/user'
import AccountService from '@rebel/server/services/AccountService'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore from '@rebel/server/stores/RankStore'
import { single, zipOnStrict, zipOnStrictMany } from '@rebel/server/util/arrays'
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
  accountStore: AccountStore
  accountService: AccountService
}>

@Path(buildPath('experience'))
@PreProcessor(requireStreamer)
@PreProcessor(requireRank('owner'))
export default class ExperienceController extends ControllerBase {
  private readonly channelService: ChannelService
  private readonly experienceService: ExperienceService
  private readonly punishmentService: PunishmentService
  private readonly rankStore: RankStore
  private readonly accountStore: AccountStore
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super(deps, 'experience')
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
    this.punishmentService = deps.resolve('punishmentService')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.accountService = deps.resolve('accountService')
  }

  @GET
  @Path('leaderboard')
  public async getLeaderboard (): Promise<GetLeaderboardResponse> {
    const builder = this.registerResponseBuilder<GetLeaderboardResponse>('GET /leaderboard', 4)
    try {
      const leaderboard = await this.experienceService.getLeaderboard(this.getStreamerId())
      const primaryUserIds = leaderboard.map(r => r.primaryUserId)
      const activeRanks = await this.rankStore.getUserRanks(primaryUserIds, this.getStreamerId())
      const registeredUsers = await this.accountStore.getRegisteredUsers(primaryUserIds)
      const publicLeaderboard = zipOnStrictMany(leaderboard, 'primaryUserId', activeRanks, registeredUsers)
        .map(data => rankedEntryToPublic(data))
      return builder.success({ rankedUsers: publicLeaderboard })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('rank')
  public async getRank (
    @QueryParam('id') anyUserId: number
  ): Promise<GetRankResponse> {
    const builder = this.registerResponseBuilder<GetRankResponse>('GET /rank', 4)
    if (anyUserId == null) {
      return builder.failure(400, `A value for 'id' must be provided.`)
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)

      let userChannels = await this.channelService.getActiveUserChannels(this.getStreamerId(), [primaryUserId])
      if (userChannels.length == 0) {
        return builder.failure(404, `Could not find an active channel for primary user ${primaryUserId}.`)
      }

      const leaderboard = await this.experienceService.getLeaderboard(this.getStreamerId())
      const match = leaderboard.find(l => l.primaryUserId === primaryUserId)
      if (match == null) {
        return builder.failure(404, `Could not find primary user ${primaryUserId} on the streamer's leaderboard.`)
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

      const primaryUserIds = prunedLeaderboard.map(entry => entry.primaryUserId)
      const activeRanks = await this.rankStore.getUserRanks(primaryUserIds, this.getStreamerId())
      const registeredUsers = await this.accountStore.getRegisteredUsers(primaryUserIds)
      const publicLeaderboard = zipOnStrictMany(prunedLeaderboard, 'primaryUserId', activeRanks, registeredUsers).map(rankedEntryToPublic)

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
    if (request == null || request.userId == null || request.schema !== builder.schema) {
      return builder.failure(400, 'Invalid request data.')
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      await this.experienceService.modifyExperience(primaryUserId, this.getStreamerId(), this.getCurrentUser().aggregateChatUserId, request.deltaLevels, request.message)
      const data = await this.apiService.getAllData([primaryUserId]).then(single)
      return builder.success({ updatedUser:  userDataToPublicUser(data) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
