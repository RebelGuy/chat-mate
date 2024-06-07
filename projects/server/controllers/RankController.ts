import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { PublicChannelRankChange } from '@rebel/api-models/public/rank/PublicChannelRankChange'
import { userRankToPublicObject, rankToPublicObject } from '@rebel/server/models/rank'
import LogService from '@rebel/server/services/LogService'
import ModService from '@rebel/server/services/rank/ModService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { single, sortBy, unique } from '@rebel/shared/util/arrays'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { DELETE, GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { ChatMateError, InvalidCustomRankNameError, NotFoundError, UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import RankService, { CustomisableRank, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { addTime } from '@rebel/shared/util/datetime'
import { requireAuth, requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import AccountService from '@rebel/server/services/AccountService'
import UserService from '@rebel/server/services/UserService'
import { channelToPublicChannel } from '@rebel/server/models/user'
import { AddModRankRequest, AddModRankResponse, AddUserRankRequest, AddUserRankResponse, DeleteCustomRankNameResponse, GetAccessibleRanksResponse, GetCustomisableRanksResponse, GetUserRanksResponse, RemoveModRankRequest, RemoveModRankResponse, RemoveUserRankRequest, RemoveUserRankResponse, SetCustomRankNameRequest, SetCustomRankNameResponse } from '@rebel/api-models/schema/rank'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import { generateStringRangeValidator, positiveNumberValidator } from '@rebel/server/controllers/validation'

type Deps = ControllerDependencies<{
  logService: LogService
  channelStore: ChannelStore
  modService: ModService
  rankStore: RankStore
  rankService: RankService
  accountService: AccountService
  userService: UserService
}>

@Path(buildPath('rank'))
export default class RankController extends ControllerBase {
  private readonly modService: ModService
  private readonly channelStore: ChannelStore
  private readonly rankStore: RankStore
  private readonly rankService: RankService
  private readonly accountService: AccountService
  private readonly userService: UserService

  constructor (deps: Deps) {
    super(deps, 'rank')
    this.modService = deps.resolve('modService')
    this.channelStore = deps.resolve('channelStore')
    this.rankStore = deps.resolve('rankStore')
    this.rankService = deps.resolve('rankService')
    this.accountService = deps.resolve('accountService')
    this.userService = deps.resolve('userService')
  }

  @GET
  @PreProcessor(requireAuth)
  public async getUserRanks (
    @QueryParam('userId') anyUserId?: number,
    @QueryParam('includeInactive') includeInactive?: boolean // if not set, returns only active ranks
  ): Promise<GetUserRanksResponse> {
    const builder = this.registerResponseBuilder<GetUserRanksResponse>('GET')

    const validationError = builder.validateInput({
      userId: { type: 'number', optional: true },
      includeInactive: { type: 'boolean', optional: true }
    }, { userId: anyUserId, includeInactive })
    if (validationError != null) {
      return validationError
    }

    try {
      if (anyUserId == null) {
        anyUserId = this.getCurrentUser().aggregateChatUserId
      }
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)
      const streamerId = this.getStreamerId(true)

      let ranks: UserRankWithRelations[]
      if (includeInactive === true) {
        ranks = await this.rankStore.getUserRankHistory(primaryUserId, streamerId)
      } else {
        ranks = single(await this.rankStore.getUserRanks([primaryUserId], streamerId)).ranks
      }

      ranks = sortBy(ranks, p => p.issuedAt.getTime(), 'desc')
      return builder.success({ ranks: await this.userRanksToPublicObjects(streamerId, ranks) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/accessible')
  @PreProcessor(requireStreamer)
  public async getAccessibleRanks (): Promise<GetAccessibleRanksResponse> {
    const builder = this.registerResponseBuilder<GetAccessibleRanksResponse>('GET /accessible')

    try {
      const accessibleRanks = await this.rankService.getAccessibleRanks()
      return builder.success({
        accessibleRanks: accessibleRanks.map(rankToPublicObject)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async addUserRank (request: AddUserRankRequest): Promise<AddUserRankResponse> {
    const builder = this.registerResponseBuilder<AddUserRankResponse>('POST')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true },
      durationSeconds: { type: 'number', nullable: true, validators: [positiveNumberValidator] },
      rank: { type: 'string', validators: [generateStringRangeValidator('famous', 'donator', 'supporter', 'member')] }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      if (await this.userService.isUserBusy(primaryUserId)) {
        throw new ChatMateError('Cannot add the user rank at this time. Please try again later.')
      }

      const streamerId = this.getStreamerId()
      const args: AddUserRankArgs = {
        rank: request.rank,
        primaryUserId: primaryUserId,
        streamerId: streamerId,
        message: request.message,
        expirationTime: request.durationSeconds ? addTime(new Date(), 'seconds', request.durationSeconds) : null,
        assignee: this.getCurrentUser().id
      }
      const result = await this.rankStore.addUserRank(args)

      return builder.success({ newRank: await this.userRankToPublicObject(result) })
    } catch (e: any) {
      if (e instanceof UserRankAlreadyExistsError) {
        return builder.failure(400, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  @DELETE
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async removeUserRank (request: RemoveUserRankRequest): Promise<RemoveUserRankResponse> {
    const builder = this.registerResponseBuilder<RemoveUserRankResponse>('DELETE')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true },
      rank: { type: 'string', validators: [generateStringRangeValidator('famous', 'donator', 'supporter', 'member')] }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      if (await this.userService.isUserBusy(primaryUserId)) {
        throw new ChatMateError('Cannot renove the user rank at this time. Please try again later.')
      }

      const args: RemoveUserRankArgs = {
        rank: request.rank,
        primaryUserId: primaryUserId,
        streamerId: this.getStreamerId(),
        message: request.message,
        removedBy: this.getCurrentUser().id
      }
      const result = await this.rankStore.removeUserRank(args)

      return builder.success({ removedRank: await this.userRankToPublicObject(result) })
    } catch (e: any) {
      if (e instanceof UserRankNotFoundError) {
        return builder.failure(404, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  @POST
  @Path('/mod')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async addModRank (request: AddModRankRequest): Promise<AddModRankResponse> {
    const builder = this.registerResponseBuilder<AddModRankResponse>('POST /mod')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.modService.setModRank(primaryUserId, this.getStreamerId(), this.getCurrentUser().aggregateChatUserId, true, request.message, null)
      return builder.success({
        newRank: result.rankResult.rank ==  null ? null : await this.userRankToPublicObject(result.rankResult.rank),
        newRankError: result.rankResult.error,
        channelModChanges: await this.getChannelRankChanges(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @DELETE
  @Path('/mod')
  @PreProcessor(requireStreamer)
  @PreProcessor(requireRank('owner'))
  public async removeModRank (request: RemoveModRankRequest): Promise<RemoveModRankResponse> {
    const builder = this.registerResponseBuilder<RemoveModRankResponse>('DELETE /mod')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.modService.setModRank(primaryUserId, this.getStreamerId(), this.getCurrentUser().aggregateChatUserId, false, request.message, null)
      return builder.success({
        removedRank: result.rankResult.rank ==  null ? null : await this.userRankToPublicObject(result.rankResult.rank),
        removedRankError: result.rankResult.error,
        channelModChanges: await this.getChannelRankChanges(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/customise')
  public async getCustomisableRanks (): Promise<GetCustomisableRanksResponse> {
    const builder = this.registerResponseBuilder<GetCustomisableRanksResponse>('GET /customise')

    try {
      const customisableRanks = await this.rankService.getCustomisableRanks()
      return builder.success({
        customisableRanks: customisableRanks.map(rankToPublicObject)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/customise')
  @PreProcessor(requireAuth)
  @PreProcessor(requireStreamer)
  public async setCustomName (request: SetCustomRankNameRequest): Promise<SetCustomRankNameResponse> {
    const builder = this.registerResponseBuilder<SetCustomRankNameResponse>('POST /customise')

    const validationError = builder.validateInput({
      name: { type: 'string' },
      rank: { type: 'string' },
      isActive: { type: 'boolean', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = this.getCurrentUser().aggregateChatUserId
      const rank = request.rank as CustomisableRank
      const name = request.name
      const isActive = request.isActive === true

      await this.rankService.addOrUpdateCustomRankName(streamerId, primaryUserId, rank, name, isActive)
      return builder.success({})
    } catch (e: any) {
      if (e instanceof InvalidCustomRankNameError) {
        return builder.failure(400, e.message)
      } else {
        return builder.failure(e)
      }
    }
  }

  @DELETE
  @Path('/customise')
  @PreProcessor(requireAuth)
  @PreProcessor(requireStreamer)
  public async deleteCustomName (
    @QueryParam('rank') rank: CustomisableRank
  ): Promise<DeleteCustomRankNameResponse> {
    const builder = this.registerResponseBuilder<SetCustomRankNameResponse>('DELETE /customise')

    const validationError = builder.validateInput({
      rank: { type: 'string', validators: [generateStringRangeValidator('donator', 'supporter', 'member')] }
    }, { rank })
    if (validationError != null) {
      return validationError
    }

    try {
      await this.rankStore.deleteCustomRankName(this.getStreamerId(), this.getCurrentUser().aggregateChatUserId, rank)
      return builder.success({})
    } catch (e: any) {
      if (e instanceof NotFoundError) {
        return builder.failure(404, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  private async getChannelRankChanges (results: { youtubeResults: YoutubeRankResult[], twitchResults: TwitchRankResult[] }): Promise<PublicChannelRankChange[]> {
    const makePublicResult = async (channelId: number, platform: 'youtube' | 'twitch', error: string | null): Promise<PublicChannelRankChange> => {
      let channel: UserChannel
      if (platform === 'youtube') {
        channel = await this.channelStore.getYoutubeChannelsFromChannelIds([channelId]).then(single)
      } else if (platform === 'twitch') {
        channel = await this.channelStore.getTwitchChannelsFromChannelIds([channelId]).then(single)
      } else {
        assertUnreachable(platform)
      }

      return {
        channel: channelToPublicChannel(channel),
        error: error,
      }
    }

    return await Promise.all([
      ...results.youtubeResults.map(c => makePublicResult(c.youtubeChannelId, 'youtube', c.error)),
      ...results.twitchResults.map(c => makePublicResult(c.twitchChannelId, 'twitch', c.error))
    ])
  }

  private async userRanksToPublicObjects (streamerId: number | null, ranks: UserRankWithRelations[]): Promise<PublicUserRank[]> {
    const primaryUserIds = unique(ranks.map(r => r.primaryUserId))
    const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, primaryUserIds)

    return ranks.map(r => {
      const entry = customRankNames.find(c => c.primaryUserId === r.primaryUserId)?.customRankNames ?? {}
      return userRankToPublicObject(r, entry[r.rank.name] ?? null)
    })
  }

  private async userRankToPublicObject (rank: UserRankWithRelations): Promise<PublicUserRank> {
    return await this.userRanksToPublicObjects(rank.streamerId, [rank]).then(single)
  }
}
