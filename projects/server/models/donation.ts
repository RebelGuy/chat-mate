import { Donation } from '@prisma/client'
import { PublicDonation } from '@rebel/server/controllers/public/donation/PublicDonation'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

export function donationToPublicObject (donation: Donation, linkedUser: PublicUser | null): PublicDonation {
  if (donation.linkedUserId == null && linkedUser != null || donation.linkedUserId != null && linkedUser == null) {
    throw new Error('Cannot create public donation object because the provided linked user is unexpected')
  } else if (donation.currency !== 'USD') {
    throw new Error('Unexpected donation currency ' + donation.currency)
  }

  return {
    schema: 1,
    id: donation.id,
    time: donation.time.getTime(),
    amount: donation.amount,
    currency: donation.currency,
    message: donation.message ?? null,
    name: donation.name,
    linkedUser: linkedUser ?? null
  }
}
