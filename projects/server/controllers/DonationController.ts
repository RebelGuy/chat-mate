import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { PublicDonation } from '@rebel/api-models/public/donation/PublicDonation'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { donationToPublicObject } from '@rebel/server/models/donation'
import { userDataToPublicUser } from '@rebel/server/models/user'
import DonationService, { DonationWithUser, NewDonation } from '@rebel/server/services/DonationService'
import DonationStore from '@rebel/server/stores/DonationStore'
import { nonNull, unique } from '@rebel/shared/util/arrays'
import { DELETE, GET, Path, POST, PreProcessor, QueryParam } from 'typescript-rest'
import { single } from '@rebel/shared/util/arrays'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/shared/util/error'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import AccountService from '@rebel/server/services/AccountService'
import { CreateDonationRequest, CreateDonationResponse, DeleteDonationResponse, GetCurrenciesResponse, GetDonationsResponse, GetStreamlabsStatusResponse, LinkUserResponse, RefundDonationResponse, SetWebsocketTokenRequest, SetWebsocketTokenResponse, UnlinkUserResponse } from '@rebel/api-models/schema/donation'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { CURRENCIES, CurrencyCode } from '@rebel/server/constants'
import { mapOverKeys } from '@rebel/shared/util/objects'
import { generateExclusiveNumberRangeValidator, nonEmptyStringValidator } from '@rebel/server/controllers/validation'

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
      const donations = await this.donationService.getDonationsSince(this.getStreamerId(), 0, true)
      return builder.success({
        donations: await this.getPublicDonations(donations)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('/')
  public async createDonation (request: CreateDonationRequest): Promise<CreateDonationResponse> {
    const builder = this.registerResponseBuilder<CreateDonationResponse>('POST /')

    const validationError = builder.validateInput({
      amount: { type: 'number', validators: [generateExclusiveNumberRangeValidator(0, 100_000)] },
      currencyCode: { type: 'string', validators: [nonEmptyStringValidator] },
      name: { type: 'string', validators: [nonEmptyStringValidator] },
      message: { type: 'string', nullable: true, optional: true }
    }, request)

    if (validationError != null) {
      return validationError
    }

    try {
      const currencyCodes = Object.keys(CURRENCIES)
      const requestCurrency = request.currencyCode.toUpperCase().trim()
      if (!currencyCodes.includes(requestCurrency)) {
        return builder.failure(400, `Invalid currency code ${requestCurrency}. Must be one of the following: ${currencyCodes.join(', ')}.`)
      }

      const formattedAmount = request.amount.toLocaleString('en-US', { style: 'currency', currency: requestCurrency, minimumFractionDigits: 2 })

      const donationData: NewDonation = {
        createdAt: Date.now(),
        amount: request.amount,
        currency: requestCurrency as CurrencyCode,
        formattedAmount: formattedAmount,
        message: isNullOrEmpty(request.message) ? null : request.message.trim(),
        name: request.name.trim(),
        streamlabsDonationId: null,
        streamlabsUserId: null
      }

      const newId = await this.donationService.addDonation(donationData, this.getStreamerId())
      return builder.success({ newDonation: await this.getPublicDonation(newId) })
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

    const validationError = builder.validateInput({ donationId: { type: 'number' }}, { donationId })
    if (validationError != null) {
      return validationError
    }

    try {
      const donation = await this.donationService.getDonation(this.getStreamerId(), donationId)
      await this.donationStore.deleteDonation(this.getStreamerId(), donationId)

      if (donation.primaryUserId) {
        await this.donationService.reEvaluateDonationRanks(donation.primaryUserId, 'Donation deleted', `Delete ${donationId}`)
      }

      return builder.success({ })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/currencies')
  public getCurrencyCodes (): GetCurrenciesResponse {
    const builder = this.registerResponseBuilder<GetCurrenciesResponse>('GET /currencies')

    try {
      const currencies = mapOverKeys(CURRENCIES, (key, value) => ({ code: key, description: value }))
      return builder.success({ currencies })
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

    const validationError = builder.validateInput({
      donationId: { type: 'number' },
      userId: { type: 'number' }
    }, { donationId, userId: anyUserId })
    if (validationError != null) {
      return validationError
    }

    try {
      const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)
      await this.donationService.linkUserToDonation(this.getStreamerId(), donationId, primaryUserId)

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

    const validationError = builder.validateInput({ donationId: { type: 'number' }}, { donationId })
    if (validationError != null) {
      return validationError
    }

    try {
      await this.donationService.unlinkUserFromDonation(this.getStreamerId(), donationId)

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

    const validationError = builder.validateInput({ donationId: { type: 'number' }}, { donationId })
    if (validationError != null) {
      return validationError
    }

    try {
      const donation = await this.donationService.getDonation(this.getStreamerId(), donationId)
      if (donation.refundedAt != null) {
        return builder.failure(400, 'Donation is already refunded.')
      }

      await this.donationStore.refundDonation(this.getStreamerId(), donationId)

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

    const validationError = builder.validateInput({ websocketToken: { type: 'string', nullable: true, validators: [nonEmptyStringValidator] }},request)
    if (validationError != null) {
      return validationError
    }

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
    const donation = await this.donationService.getDonation(this.getStreamerId(), donationId)
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
