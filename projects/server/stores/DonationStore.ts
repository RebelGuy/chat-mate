import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { New } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class DonationStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public async addDonation (donation: New<Donation>): Promise<Donation> {
    return await this.db.donation.create({ data: {
      amount: donation.amount,
      currency: donation.currency,
      name: donation.name,
      streamlabsId: donation.streamlabsId,
      time: donation.time,
      linkedUserId: null,
      message: donation.message ?? null
    }})
  }

  /** Returns donations that have been linked to the user, orderd by time in ascending order. */
  public async getDonationsByUserId (userId: number): Promise<Donation[]> {
    return await this.db.donation.findMany({
      where: { linkedUserId: userId },
      orderBy: { time: 'asc' }
    })
  }

  /** Returns donations after the given time, ordered by time in ascending order. */
  public async getDonationsSince (time: Date): Promise<Donation[]> {
    return await this.db.donation.findMany({
      where: { time: { gt: time }},
      orderBy: { time: 'asc' }
    })
  }

  /** Returns the highest Streamlabs donation ID contained in the database. */
  public async getLastStreamlabsId (): Promise<number | null> {
    const result = await this.db.donation.findFirst({
      select: { streamlabsId: true },
      orderBy: { streamlabsId: 'desc' },
      take: 1
    })

    return result?.streamlabsId ?? null
  }

  // we perform side effects when linking/unlinking, so it makes sense to enforce that only a single operation can happen.
  // we could probably enforce this on a database-level by using a separated link table, but that's overkill

  /** @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (donationId: number, userId: number): Promise<Donation> {
    const donationWithUser = await this.db.donation.findFirst({
      where: {
        id: donationId,
        linkedUserId: { not: null }
      }
    })

    if (donationWithUser != null) {
      throw new DonationUserLinkAlreadyExistsError()
    }

    return await this.db.donation.update({
      where: { id: donationId },
      data: { linkedUserId: userId }
    })
  }

  /** Returns the updated donation, as well as the userId that was unlinked.
   * @throws {@link DonationUserLinkNotFoundError}: When a link does not exist for the donation. */
  public async unlinkUserFromDonation (donationId: number): Promise<[Donation, number]> {
    const donationWitUser = await this.db.donation.findFirst({
      where: {
        id: donationId,
        linkedUserId: { not: null }
      }
    })

    if (donationWitUser == null) {
      throw new DonationUserLinkNotFoundError()
    }

    const updatedDonation = await this.db.donation.update({
      where: { id: donationId },
      data: { linkedUserId: null }
    })
    return [updatedDonation, donationWitUser.linkedUserId!]
  }
}
