import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { New } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'

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

  public async linkUserToDonation (donationId: number, userId: number): Promise<Donation> {
    return await this.db.donation.update({
      where: { id: donationId },
      data: { linkedUserId: userId }
    })
  }
}
