import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { New } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { single } from '@rebel/server/util/arrays'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'

export type DonationWithUser = Donation & {
  userId: number | null
}

const INTERNAL_USER_PREFIX = 'internal-'

const EXTERNAL_USER_PREFIX = 'external-'

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
      streamlabsId: donation.streamlabsId,
      streamlabsUserId: donation.streamlabsUserId ?? null,
      amount: donation.amount,
      formattedAmount: donation.formattedAmount,
      currency: donation.currency,
      name: donation.name,
      time: donation.time,
      message: donation.message ?? null
    }})
  }

  /** Returns donations that have been linked to the user, orderd by time in ascending order. */
  public async getDonationsByUserId (userId: number): Promise<Donation[]> {
    const streamlabsUsers = await this.db.streamlabsUser.findMany({ where: { linkedUserId: userId }})
    const compoundIds = streamlabsUsers.map(u => u.streamlabsUserId)
    const internalIds = compoundIds.filter(id => id.startsWith(INTERNAL_USER_PREFIX)).map(id => Number(id.substring(INTERNAL_USER_PREFIX.length)))
    const externalIds = compoundIds.filter(id => id.startsWith(EXTERNAL_USER_PREFIX)).map(id => Number(id.substring(EXTERNAL_USER_PREFIX.length)))

    return await this.db.donation.findMany({
      where: {
        OR: [
          { id: { in: internalIds } },
          { streamlabsUserId: { in: externalIds }}
        ]
      },
      orderBy: { time: 'asc' }
    })
  }

  public async getDonation (donationId: number): Promise<DonationWithUser> {
    const donation = await this.db.donation.findUnique({
      where: { id: donationId },
      rejectOnNotFound: true
    })

    const streamlabsUserId = await this.getStreamlabsUserId(donationId)
    const streamlabsUser = await this.db.streamlabsUser.findUnique({
      where: { streamlabsUserId: streamlabsUserId },
      rejectOnNotFound: false
    })

    return { ...donation, userId: streamlabsUser?.linkedUserId ?? null }
  }

  /** Returns donations after the given time, ordered by time in ascending order. */
  public async getDonationsSince (time: number): Promise<DonationWithUser[]> {
    const donations = await this.db.donation.findMany({
      where: { time: { gt: new Date(time) }},
      orderBy: { time: 'asc' }
    })

    const streamlabsUserIds = await this.getStreamlabsUserIds(donations.map(d => d.id))
    const streamlabsUsers = await this.db.streamlabsUser.findMany({
      where: { streamlabsUserId: { in: streamlabsUserIds.map(ids => ids[1]) }}
    })

    return donations.map(donation => {
      const streamlabsUserId = streamlabsUserIds.find(s => s[0] === donation.id)![1]
      const streamlabsUser = streamlabsUsers.find(u => u.streamlabsUserId === streamlabsUserId)
      return {
        ...donation,
        userId: streamlabsUser?.linkedUserId ?? null
      }
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

  // we perform side effects when linking/unlinking, which is why we separated the remove/add functionality into two methods
  // instead of just discarding the existing link.

  // an internal detail is that ChatMate users are no longer matchd to the donations directly, but rather we construct a streamlabs user
  // (either using the actual streamlabs user id, or by deterministically constructing a synthetic id that is unique to this donation)
  // and link the ChatMate user to that streamlabs user instead.

  /** Links the user to the donation.
   * @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (donationId: number, userId: number, linkedAt: Date): Promise<void> {
    const streamlabsUserId = await this.getStreamlabsUserId(donationId)

    const existingLink = await this.db.streamlabsUser.findFirst({ where: { streamlabsUserId }})
    if (existingLink != null) {
      throw new DonationUserLinkAlreadyExistsError()
    }

    await this.db.streamlabsUser.create({ data: {
      streamlabsUserId: streamlabsUserId,
      linkedUserId: userId,
      linkedAt: linkedAt
    }})
  }

  /** Returns the userId that was unlinked.
   * @throws {@link DonationUserLinkNotFoundError}: When a link does not exist for the donation. */
  public async unlinkUserFromDonation (donationId: number): Promise<number> {
    const streamlabsUserId = await this.getStreamlabsUserId(donationId)

    const existingLink = await this.db.streamlabsUser.findFirst({ where: { streamlabsUserId }})
    if (existingLink == null) {
      throw new DonationUserLinkNotFoundError()
    }

    await this.db.streamlabsUser.delete({
      where: { id: existingLink.id }
    })
    return existingLink.linkedUserId
  }

  private async getStreamlabsUserId (donationId: number): Promise<string> {
    return single(await this.getStreamlabsUserIds([donationId]))[1]
  }

  /** Returns the donationId-streamlabsUserId pairs. */
  private async getStreamlabsUserIds (donationIds: number[]): Promise<[number, string][]> {
    const donations = await this.db.donation.findMany({
      where: { id: { in: donationIds }}
    })

    return donations.map(donation => {
      return [donation.id, donation.streamlabsUserId == null ? `${INTERNAL_USER_PREFIX}${donation.id}` : `${EXTERNAL_USER_PREFIX}${donation.streamlabsUserId}`]
    })
  }
}
