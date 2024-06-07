import { Dependencies } from '@rebel/shared/context/context'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import DonationService, { NewDonation } from '@rebel/server/services/DonationService'
import { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import EventDispatchService, { EVENT_STREAMLABS_DONATION, EventData } from '@rebel/server/services/EventDispatchService'

type Deps = Dependencies<{
  eventDispatchService: EventDispatchService
  donationService: DonationService
}>

export default class DonationFetchService extends SingletonContextClass {
  private readonly eventDispatchService: EventDispatchService
  private readonly donationService: DonationService

  constructor (deps: Deps) {
    super()

    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.donationService = deps.resolve('donationService')
  }

  override async initialise () {
    const lastSavedId = -1 // await this.donationStore.getLastStreamlabsId()
    const donations: StreamlabsDonation[] = [] // await this.streamlabsProxyService.getDonationsAfterId(lastSavedId) // todo: need to do this for each streamer

    for (const donation of donations) {
      await this.onDonation({ streamlabsDonation: donation, streamerId: 1 })
    }

    this.eventDispatchService.onData(EVENT_STREAMLABS_DONATION, this.onDonation)
  }

  private onDonation = async (data: EventData[typeof EVENT_STREAMLABS_DONATION]) => {
    const { streamlabsDonation, streamerId } = data
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
