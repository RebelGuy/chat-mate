import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { PublicDonation } from '@rebel/api-models/public/donation/PublicDonation'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { donationToPublicObject } from '@rebel/server/models/donation'
import { userDataToPublicUser } from '@rebel/server/models/user'
import DonationService from '@rebel/server/services/DonationService'
import DonationStore, { DonationWithUser } from '@rebel/server/stores/DonationStore'
import { nonNull, unique } from '@rebel/shared/util/arrays'
import { DELETE, GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { single } from '@rebel/shared/util/arrays'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/shared/util/error'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import AccountService from '@rebel/server/services/AccountService'
import { DeleteDonationResponse, GetDonationsResponse, GetStreamlabsStatusResponse, LinkUserResponse, RefundDonationResponse, SetWebsocketTokenRequest, SetWebsocketTokenResponse, UnlinkUserResponse } from '@rebel/api-models/schema/donation'

type Deps = ControllerDependencies<{
  donationService: DonationService
  donationStore: DonationStore
  accountService: AccountService
}>

@Path(buildPath('donation'))
@PreProcessor(requireStreamer)
@PreProcessor(requireRank('owner'))
export default class DonationController extends ControllerBase {
  private readonly donationService: DonationService
  private readonly donationStore: DonationStore
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super(deps, 'donation')
    this.donationService = deps.resolve('donationService')
    this.donationStore = deps.resolve('donationStore')
    this.accountService = deps.resolve('accountService')
  }

  @GET
  @Path('/')
  public async getDonations (): Promise<GetDonationsResponse> {
    const builder = this.registerResponseBuilder<GetDonationsResponse>('GET /')
    try {
      const donations = await this.donationStore.getDonationsSince(this.getStreamerId(), 0, true)
      return builder.success({
        donations: await this.getPublicDonations(donations)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @DELETE
  @Path('/')
  public async deleteDonation (
    @QueryParam('donationId') donationId: number
  ): Promise<DeleteDonationResponse> {
    const builder = this.registerResponseBuilder<DeleteDonationResponse>('DELETE /')

    if (donationId == null) {
      builder.failure(400, 'A donation ID must be provided.')
    }

    try {
      const donation = await this.donationStore.getDonation(donationId)
      if (donation.streamerId !== this.getStreamerId()) {
        return builder.failure(404, 'Not found.')
      }

      await this.donationStore.deleteDonation(donationId)

      if (donation.primaryUserId) {
        await this.donationService.reEvaluateDonationRanks(donation.primaryUserId, 'Donation deleted', `Delete ${donationId}`)
      }

      return builder.success({ })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/link')
  public async linkUser (
    @QueryParam('donationId') donationId: number,
    @QueryParam('userId') anyUserId: number
  ): Promise<LinkUserResponse> {
    const builder = this.registerResponseBuilder<LinkUserResponse>('POST /link')

    if (donationId == null || anyUserId == null) {
      builder.failure('A donation ID and user ID must be provided.')
    }

    try {
      const donation = await this.donationStore.getDonation(donationId)
      if (donation.streamerId !== this.getStreamerId()) {
        return builder.failure(404, 'Not found.')
      }

      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)
      await this.donationService.linkUserToDonation(donationId, primaryUserId, this.getStreamerId())

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
  @Path('/link')
  public async unlinkUser (
    @QueryParam('donationId') donationId: number
  ): Promise<LinkUserResponse> {
    const builder = this.registerResponseBuilder<UnlinkUserResponse>('DELETE /link')

    if (donationId == null) {
      builder.failure(400, 'A donation ID must be provided.')
    }

    try {
      const donation = await this.donationStore.getDonation(donationId)
      if (donation.streamerId !== this.getStreamerId()) {
        return builder.failure(404, 'Not found.')
      }

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
  @Path('/refund')
  public async refundDonation (
    @QueryParam('donationId') donationId: number
  ): Promise<RefundDonationResponse> {
    const builder = this.registerResponseBuilder<RefundDonationResponse>('POST /refund')

    if (donationId == null) {
      builder.failure(400, 'A donation ID must be provided.')
    }

    try {
      const donation = await this.donationStore.getDonation(donationId)
      if (donation.streamerId !== this.getStreamerId()) {
        return builder.failure(404, 'Not found.')
      } else if (donation.refundedAt != null) {
        return builder.failure(400, 'Donation is already refunded.')
      }

      await this.donationStore.refundDonation(donationId)

      if (donation.primaryUserId) {
        await this.donationService.reEvaluateDonationRanks(donation.primaryUserId, 'Donation refunded', `Refund ${donationId}`)
      }

      const updatedDonation = await this.getPublicDonations([{ ...donation, refundedAt: new Date() }]).then(single)
      return builder.success({ updatedDonation })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/streamlabs/socketToken')
  public async setWebsocketToken (request: SetWebsocketTokenRequest): Promise<SetWebsocketTokenResponse> {
    const builder = this.registerResponseBuilder<SetWebsocketTokenResponse>('POST /streamlabs/socketToken')

    try {
      const hasUpdated = await this.donationService.setStreamlabsSocketToken(this.getStreamerId(), request.websocketToken)
      return builder.success({ result: hasUpdated ? 'success' : 'noChange' })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/streamlabs/status')
  public getStreamlabsStatus (): GetStreamlabsStatusResponse {
    const builder = this.registerResponseBuilder<GetStreamlabsStatusResponse>('POST /streamlabs/status')

    try {
      const status = this.donationService.getStreamlabsStatus(this.getStreamerId())
      return builder.success({ status })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  private async getPublicDonation (donationId: number): Promise<PublicDonation> {
    const donation = await this.donationStore.getDonation(donationId)
    return single(await this.getPublicDonations([donation]))
  }

  private async getPublicDonations (donations: DonationWithUser[]): Promise<PublicDonation[]> {
    const primaryUserIds = unique(nonNull(donations.map(d => d.primaryUserId)))
    let userData: PublicUser[]
    if (primaryUserIds.length === 0) {
      userData = []
    } else {
      const allData = await this.apiService.getAllData(primaryUserIds)
      userData = allData.map(userDataToPublicUser)
    }

    return donations.map(d => donationToPublicObject(d, d.linkIdentifier, d.linkedAt, userData.find(u => u.primaryUserId === d.primaryUserId) ?? null))
  }
}
