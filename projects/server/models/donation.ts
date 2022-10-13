import { Donation } from '@prisma/client'
import { PublicDonation } from '@rebel/server/controllers/public/donation/PublicDonation'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export function donationToPublicObject (donation: Donation, linkedAt: Date | null, linkedUser: PublicUser | null): PublicDonation {
  return {
    schema: 1,
    id: donation.id,
    time: donation.time.getTime(),
    amount: donation.amount,
    formattedAmount: donation.formattedAmount,
    currency: donation.currency,
    message: donation.message ?? null,
    name: donation.name,
    linkedUser: linkedUser ?? null,
    linkedAt: linkedAt?.getTime() ?? null
  }
}
