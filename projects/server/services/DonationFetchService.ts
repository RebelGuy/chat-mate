import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DonationService, { NewDonation } from '@rebel/server/services/DonationService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'

type Deps = Dependencies<{
  streamlabsProxyService: StreamlabsProxyService
  donationService: DonationService
}>

export default class DonationFetchService extends ContextClass {
  private readonly streamlabsProxyService: StreamlabsProxyService
  private readonly donationService: DonationService

  constructor (deps: Deps) {
    super()

    this.streamlabsProxyService = deps.resolve('streamlabsProxyService')
    this.donationService = deps.resolve('donationService')
  }

  override async initialise () {
    const lastSavedId = -1 // await this.donationStore.getLastStreamlabsId()
    const donations: StreamlabsDonation[] = [] // await this.streamlabsProxyService.getDonationsAfterId(lastSavedId) // todo: need to do this for each streamer

    for (const donation of donations) {
      await this.onDonation(donation, 1)
    }

    this.streamlabsProxyService.setDonationCallback(this.onDonation)
  }

  private onDonation = async (streamlabsDonation: StreamlabsDonation, streamerId: number) => {
    const newDonation: NewDonation = {
      amount: streamlabsDonation.amount,
      createdAt: streamlabsDonation.createdAt,
      currency: streamlabsDonation.currency,
      formattedAmount: streamlabsDonation.formattedAmount,
      message: streamlabsDonation.message,
      name: streamlabsDonation.name,
      streamlabsDonationId: streamlabsDonation.donationId,
      streamlabsUserId: streamlabsDonation.streamlabsUserId
    }

    await this.donationService.addDonation(newDonation, streamerId)
  }
}
