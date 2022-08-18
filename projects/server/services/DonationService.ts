import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DonationStore from '@rebel/server/stores/DonationStore'

type Deps = Dependencies<{
  donationStore: DonationStore
}>

export default class DonationService extends ContextClass {
  private readonly donationStore: DonationStore

  constructor (deps: Deps) {
    super()
    
    this.donationStore = deps.resolve('donationStore')
  }

  /** @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (donationId: number, userId: number): Promise<Donation> {
    const updatedDonation = await this.donationStore.linkUserToDonation(donationId, userId)

    // todo: perform side effects

    return updatedDonation
  }

  /** @throws {@link DonationUserLinkNotFoundError}: When a link does not exist for the donation. */
  public async unlinkUserFromDonation (donationId: number): Promise<Donation> {
    const updatedDonation = await this.donationStore.unlinkUserFromDonation(donationId)

    // todo: perform side effects

    return updatedDonation
  }
}
