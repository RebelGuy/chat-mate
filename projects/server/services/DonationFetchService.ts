import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import DonationStore from '@rebel/server/stores/DonationStore'
import { eps } from '@rebel/server/util/math'

type Deps = Dependencies<{
  streamlabsProxyService: StreamlabsProxyService
  donationStore: DonationStore
}>

export default class DonationFetchService extends ContextClass {
  private readonly streamlabsProxyService: StreamlabsProxyService
  private readonly donationStore: DonationStore

  constructor (deps: Deps) {
    super()

    this.streamlabsProxyService = deps.resolve('streamlabsProxyService')
    this.donationStore = deps.resolve('donationStore')
  }

  override async initialise () {
    const lastSavedId = 1 // await this.donationStore.getLastStreamlabsId()
    const donations = await this.streamlabsProxyService.getDonationsAfterId(lastSavedId)

    for (const donation of donations) {
      await this.onDonation(donation)
    }

    this.streamlabsProxyService.listen(this.onDonation)
  }

  private onDonation = async (donation: StreamlabsDonation) => {
    await this.donationStore.addDonation({
      amount: donation.amount,
      formattedAmount: donation.formattedAmount,
      currency: donation.currency,
      name: donation.name,
      streamlabsId: donation.donationId,
      time: new Date(donation.createdAt),
      message: donation.message
    })
  }
}
