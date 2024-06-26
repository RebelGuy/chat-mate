import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { rankedEntryToPublic } from '@rebel/server/models/experience'
import { userDataToPublicUser } from '@rebel/server/models/user'
import AccountService from '@rebel/server/services/AccountService'
import ChannelService from '@rebel/server/services/ChannelService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore from '@rebel/server/stores/RankStore'
import { single, zipOnStrictMany } from '@rebel/shared/util/arrays'
import { GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { GetLeaderboardResponse, GetRankResponse, ModifyExperienceRequest, ModifyExperienceResponse } from '@rebel/api-models/schema/experience'

type Deps = ControllerDependencies<{
  channelService: ChannelService
  experienceService: ExperienceService
  punishmentService: PunishmentService
  rankStore: RankStore
  accountStore: AccountStore
  accountService: AccountService
  chatStore: ChatStore
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
  private readonly chatStore: ChatStore

  constructor (deps: Deps) {
    super(deps, 'experience')
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
    this.punishmentService = deps.resolve('punishmentService')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.accountService = deps.resolve('accountService')
    this.chatStore = deps.resolve('chatStore')
  }

  @GET
  @Path('leaderboard')
  public async getLeaderboard (): Promise<GetLeaderboardResponse> {
    const builder = this.registerResponseBuilder<GetLeaderboardResponse>('GET /leaderboard')
    try {
      const streamerId = this.getStreamerId()
      const leaderboard = await this.experienceService.getLeaderboard(streamerId)
      const primaryUserIds = leaderboard.map(r => r.primaryUserId)
      const [activeRanks, registeredUsers, firstSeen, customRankNames] = await Promise.all([
        this.rankStore.getUserRanks(primaryUserIds, streamerId),
        this.accountStore.getRegisteredUsers(primaryUserIds),
        this.chatStore.getTimeOfFirstChat(streamerId, primaryUserIds),
        this.rankStore.getCustomRankNamesForUsers(streamerId, primaryUserIds)
      ])
      const publicLeaderboard = zipOnStrictMany(leaderboard, 'primaryUserId', activeRanks, registeredUsers, firstSeen, customRankNames)
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
    const builder = this.registerResponseBuilder<GetRankResponse>('GET /rank')

    const validationError = builder.validateInput({ id: { type: 'number' }}, { id: anyUserId })
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)

      let userChannels = await this.channelService.getActiveUserChannels(streamerId, [primaryUserId])
      if (userChannels.length === 0) {
        return builder.failure(404, `Could not find an active channel for primary user ${primaryUserId}.`)
      }

      const leaderboard = await this.experienceService.getLeaderboard(streamerId)
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
      const [activeRanks, registeredUsers, firstSeen, customRankNames] = await Promise.all([
        this.rankStore.getUserRanks(primaryUserIds, streamerId),
        this.accountStore.getRegisteredUsers(primaryUserIds),
        this.chatStore.getTimeOfFirstChat(streamerId, primaryUserIds),
        this.rankStore.getCustomRankNamesForUsers(streamerId, primaryUserIds)
      ])
      const publicLeaderboard = zipOnStrictMany(prunedLeaderboard, 'primaryUserId', activeRanks, registeredUsers, firstSeen, customRankNames).map(rankedEntryToPublic)

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
    const builder = this.registerResponseBuilder<ModifyExperienceResponse>('POST /modify')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      deltaLevels: { type: 'number' },
      message: { type: 'string', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
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
