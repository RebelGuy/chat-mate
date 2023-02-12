import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DonationService from '@rebel/server/services/DonationService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import DonationStore from '@rebel/server/stores/DonationStore'
import { eps } from '@rebel/shared/util/math'

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
    const donations = await this.streamlabsProxyService.getDonationsAfterId(lastSavedId)

    for (const donation of donations) {
      await this.onDonation(donation, 1)
    }

    this.streamlabsProxyService.setDonationCallback(this.onDonation)
  }

  private onDonation = async (donation: StreamlabsDonation, streamerId: number) => {
    await this.donationService.addDonation(donation, streamerId)
  }
}
