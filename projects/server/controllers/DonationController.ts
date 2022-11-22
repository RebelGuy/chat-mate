import { Donation } from '@prisma/client'
import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicDonation } from '@rebel/server/controllers/public/donation/PublicDonation'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { donationToPublicObject } from '@rebel/server/models/donation'
import { userDataToPublicUser } from '@rebel/server/models/user'
import ChannelService from '@rebel/server/services/ChannelService'
import DonationService from '@rebel/server/services/DonationService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import DonationStore, { DonationWithUser } from '@rebel/server/stores/DonationStore'
import RankStore from '@rebel/server/stores/RankStore'
import { nonNull, zipOnStrictMany } from '@rebel/server/util/arrays'
import { DELETE, GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { single } from '@rebel/server/util/arrays'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'

type GetDonationsResponse = ApiResponse<1, { donations: Tagged<1, PublicDonation>[] }>

type LinkUserResponse = ApiResponse<1, { updatedDonation: Tagged<1, PublicDonation> }>

type UnlinkUserResponse = ApiResponse<1, { updatedDonation: Tagged<1, PublicDonation> }>

export type SetWebsocketTokenRequest = ApiRequest<1, { schema: 1, websocketToken: string | null }>
export type SetWebsocketTokenResponse = ApiResponse<1, { result: 'success' | 'noChange' }>

type Deps = ControllerDependencies<{
  donationService: DonationService
  donationStore: DonationStore
  channelService: ChannelService
  experienceService: ExperienceService
  rankStore: RankStore
}>

@Path(buildPath('donation'))
@PreProcessor(requireStreamer)
@PreProcessor(requireRank('owner'))
export default class DonationController extends ControllerBase {
  private readonly donationService: DonationService
  private readonly donationStore: DonationStore
  private readonly channelService: ChannelService
  private readonly experienceService: ExperienceService
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super(deps, 'donation')
    this.donationService = deps.resolve('donationService')
    this.donationStore = deps.resolve('donationStore')
    this.channelService = deps.resolve('channelService')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
  }

  @GET
  public async getDonations (): Promise<GetDonationsResponse> {
    const builder = this.registerResponseBuilder<GetDonationsResponse>('GET /', 1)
    try {
      const donations = await this.donationStore.getDonationsSince(this.getStreamerId(), 0)
      return builder.success({
        donations: await this.getPublicDonations(donations)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('link')
  public async linkUser (
    @QueryParam('donationId') donationId: number,
    @QueryParam('userId') userId: number
  ): Promise<LinkUserResponse> {
    const builder = this.registerResponseBuilder<LinkUserResponse>('POST /link', 1)

    if (donationId == null || userId == null) {
      builder.failure('A donation ID and user ID must be provided.')
    }

    try {
      await this.donationService.linkUserToDonation(donationId, userId, this.getStreamerId())
      return builder.success({
        updatedDonation: await this.getPublicDonation(donationId)
      })
    } catch (e: any) {
      if (e instanceof DonationUserLinkAlreadyExistsError) {
        return builder.failure(400, e)
      }
      return builder.failure(e)
    }
  }

  @DELETE
  @Path('link')
  public async unlinkUser (
    @QueryParam('donationId') donationId: number
  ): Promise<LinkUserResponse> {
    const builder = this.registerResponseBuilder<UnlinkUserResponse>('DELETE /link', 1)

    if (donationId == null) {
      builder.failure('A donation ID must be provided.')
    }

    try {
      await this.donationService.unlinkUserFromDonation(donationId, this.getStreamerId())
      return builder.success({
        updatedDonation: await this.getPublicDonation(donationId)
      })
    } catch (e: any) {
      if (e instanceof DonationUserLinkNotFoundError) {
        return builder.failure(404, e)
      }
      return builder.failure(e)
    }
  }

  @POST
  @Path('/streamlabs/socketToken')
  public async setWebsocketToken (request: SetWebsocketTokenRequest): Promise<SetWebsocketTokenResponse> {
    const builder = this.registerResponseBuilder<SetWebsocketTokenResponse>('POST /websocketToken', 1)

    try {
      const hasUpdated = await this.donationService.setStreamlabsSocketToken(this.getStreamerId(), request.websocketToken)
      return builder.success({ result: hasUpdated ? 'success' : 'noChange' })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  private async getPublicDonation (donationId: number): Promise<PublicDonation> {
    const donation = await this.donationStore.getDonation(donationId)
    return single(await this.getPublicDonations([donation]))
  }

  private async getPublicDonations (donations: DonationWithUser[]): Promise<PublicDonation[]> {
    const streamerId = this.getStreamerId()
    const userIds = nonNull(donations.map(d => d.userId))
    let userData: PublicUser[]
    if (userIds.length === 0) {
      userData = []
    } else {
      const userChannels = await this.channelService.getActiveUserChannels(streamerId, userIds)
      const levels = await this.experienceService.getLevels(streamerId, userIds)
      const ranks = await this.rankStore.getUserRanks(userIds, streamerId)
      userData = zipOnStrictMany(userChannels, 'userId', levels, ranks).map(userDataToPublicUser)
    }

    return donations.map(d => donationToPublicObject(d, d.linkIdentifier, d.linkedAt, userData.find(u => u.id === d.userId) ?? null))
  }
}
