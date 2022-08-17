import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'

type Deps = Dependencies<{
  streamlabsProxyService: StreamlabsProxyService
}>

export default class DonationFetchService extends ContextClass {
  private readonly streamlabsProxyService: StreamlabsProxyService

  constructor (deps: Deps) {
    super()

    this.streamlabsProxyService = deps.resolve('streamlabsProxyService')
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
    // notify donation service, etc
  }
}
