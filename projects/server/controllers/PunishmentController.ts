import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import { single, sortBy, unique } from '@rebel/shared/util/arrays'
import { Path, GET, QueryParam, POST, PathParam, PreProcessor } from 'typescript-rest'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { PublicChannelRankChange } from '@rebel/api-models/public/rank/PublicChannelRankChange'
import { TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import AccountService from '@rebel/server/services/AccountService'
import { channelToPublicChannel } from '@rebel/server/models/user'
import { BanUserRequest, BanUserResponse, GetSinglePunishment, GetUserPunishments, MuteUserRequest, MuteUserResponse, RevokeTimeoutRequest, RevokeTimeoutResponse, TimeoutUserRequest, TimeoutUserResponse, UnbanUserRequest, UnbanUserResponse, UnmuteUserRequest, UnmuteUserResponse } from '@rebel/api-models/schema/punishment'
import { positiveNumberValidator } from '@rebel/server/controllers/validation'

type Deps = ControllerDependencies<{
  rankStore: RankStore
  punishmentService: PunishmentService
  channelStore: ChannelStore
  accountService: AccountService
}>

@Path(buildPath('punishment'))
@PreProcessor(requireStreamer)
@PreProcessor(requireRank('mod'))
export default class PunishmentController extends ControllerBase {
  private readonly rankStore: RankStore
  private readonly punishmentService: PunishmentService
  private readonly channelStore: ChannelStore
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super(deps, 'punishment')
    this.rankStore = deps.resolve('rankStore')
    this.punishmentService = deps.resolve('punishmentService')
    this.channelStore = deps.resolve('channelStore')
    this.accountService = deps.resolve('accountService')
  }

  @GET
  @Path('/:id')
  public async getSinglePunishment (
    @PathParam('id') id: number
  ): Promise<GetSinglePunishment> {
    const builder = this.registerResponseBuilder<GetSinglePunishment>('GET /:id')

    const validationError = builder.validateInput({ id: { type: 'number' }}, { id })
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const punishment = await this.rankStore.getUserRankById(id)
      if (punishment == null || punishment.streamerId !== streamerId) {
        return builder.failure(404, `Cannot find an active punishment with id ${id}.`)
      } else {
        const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, [punishment.primaryUserId]).then(r => single(r).customRankNames)
        return builder.success({ punishment: userRankToPublicObject(punishment, customRankNames[punishment.rank.name]) })
      }
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  public async getPunishments (
    @QueryParam('userId') anyUserId?: number, // if not provided, returns punishments of all users
    @QueryParam('includeInactive') includeInactive?: boolean // if not set, returns only active punishments
  ): Promise<GetUserPunishments> {
    const builder = this.registerResponseBuilder<GetUserPunishments>('GET')

    const validationError = builder.validateInput({
      userId: { type: 'number', optional: true },
      includeInactive: { type: 'boolean', optional: true }
    }, { userId: anyUserId, includeInactive })
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = anyUserId == null ? null : await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)

      let punishments: UserRankWithRelations[]
      if (includeInactive === true) {
        if (primaryUserId == null) {
          return builder.failure(400, 'A user ID must be provided when getting the punishment history')
        }
        punishments = await this.punishmentService.getPunishmentHistory(primaryUserId, streamerId)

      } else {
        punishments = await this.punishmentService.getCurrentPunishments(streamerId)
        if (anyUserId != null) {
          punishments = punishments.filter(p => p.primaryUserId === primaryUserId)
        }
      }

      punishments = sortBy(punishments, p => p.issuedAt.getTime(), 'desc')

      const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, unique(punishments.map(p => p.primaryUserId)))

      return builder.success({ punishments: punishments.map(e => {
        const customRankNamesForUser = customRankNames.find(r => r.primaryUserId === e.primaryUserId)!.customRankNames
        return userRankToPublicObject(e, customRankNamesForUser[e.rank.name] ?? null)
      }) })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/ban')
  public async banUser (request: BanUserRequest): Promise<BanUserResponse> {
    const builder = this.registerResponseBuilder<BanUserResponse>('POST /ban')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.banUser(primaryUserId, streamerId, this.getCurrentUser().aggregateChatUserId, request.message, null)
      const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, [primaryUserId]).then(r => single(r).customRankNames)
      return builder.success({
        newPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank, customRankNames['ban']),
        newPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/unban')
  public async unbanUser (request: UnbanUserRequest): Promise<UnbanUserResponse> {
    const builder = this.registerResponseBuilder<UnbanUserResponse>('POST /unban')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.unbanUser(primaryUserId, streamerId, this.getCurrentUser().aggregateChatUserId, request.message, null)
      const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, [primaryUserId]).then(r => single(r).customRankNames)
      return builder.success({
        removedPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank, customRankNames['ban']),
        removedPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/timeout')
  public async timeoutUser (request: TimeoutUserRequest): Promise<TimeoutUserResponse> {
    const builder = this.registerResponseBuilder<TimeoutUserResponse>('POST /timeout')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true },
      durationSeconds: {
        type: 'number',
        validators: [{
          // the 1 day limit is imposed on us by the fantastic youtube api!
          onValidate: (n: number) => n >= 1 && n <= 24 * 3600,
          errorMessage: 'Duration must be at least 1 second and at most 1 day'
        }]
      }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const durationSeconds = Math.round(request.durationSeconds)
      const result = await this.punishmentService.timeoutUser(primaryUserId, streamerId, this.getCurrentUser().aggregateChatUserId, request.message, durationSeconds, null)
      const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, [primaryUserId]).then(r => single(r).customRankNames)
      return builder.success({
        newPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank, customRankNames['timeout']),
        newPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/revokeTimeout')
  public async revokeTimeout (request: RevokeTimeoutRequest): Promise<RevokeTimeoutResponse> {
    const builder = this.registerResponseBuilder<RevokeTimeoutResponse>('POST /revokeTimeout')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.untimeoutUser(primaryUserId, streamerId, this.getCurrentUser().aggregateChatUserId, request.message, null)
      const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, [primaryUserId]).then(r => single(r).customRankNames)
      return builder.success({
        removedPunishment: result.rankResult.rank == null ? null : userRankToPublicObject(result.rankResult.rank, customRankNames['timeout']),
        removedPunishmentError: result.rankResult.error,
        channelPunishments: await this.getChannelPunishments(result)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/mute')
  public async muteUser (request: MuteUserRequest): Promise<MuteUserResponse> {
    const builder = this.registerResponseBuilder<MuteUserResponse>('POST /mute')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true },
      durationSeconds: { type: 'number', nullable: true, validators: [positiveNumberValidator] }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const duration = request.durationSeconds == null || request.durationSeconds === 0 ? null : request.durationSeconds
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.muteUser(primaryUserId, streamerId, this.getCurrentUser().aggregateChatUserId, request.message, duration)
      const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, [primaryUserId]).then(r => single(r).customRankNames)
      return builder.success({ newPunishment: userRankToPublicObject(result, customRankNames['mute']) })
    } catch (e: any) {
      if (e instanceof UserRankAlreadyExistsError) {
        return builder.failure(400, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  @POST
  @Path('/unmute')
  public async unmuteUser (request: UnmuteUserRequest): Promise<UnmuteUserResponse> {
    const builder = this.registerResponseBuilder<UnmuteUserResponse>('POST /unmute')

    const validationError = builder.validateInput({
      userId: { type: 'number' },
      message: { type: 'string', nullable: true }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      const streamerId = this.getStreamerId()
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([request.userId]).then(single)
      const result = await this.punishmentService.unmuteUser(primaryUserId, streamerId, this.getCurrentUser().aggregateChatUserId, request.message)
      const customRankNames = await this.rankStore.getCustomRankNamesForUsers(streamerId, [primaryUserId]).then(r => single(r).customRankNames)
      return builder.success({ removedPunishment: userRankToPublicObject(result, customRankNames['mute']) })
    } catch (e: any) {
      if (e instanceof UserRankNotFoundError) {
        return builder.failure(404, e)
      } else {
        return builder.failure(e)
      }
    }
  }

  private async getChannelPunishments (results: { youtubeResults: YoutubeRankResult[], twitchResults: TwitchRankResult[] }): Promise<PublicChannelRankChange[]> {
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
}
