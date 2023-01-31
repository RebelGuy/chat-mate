import { Donation } from '@prisma/client'
import { PublicDonation } from '@rebel/server/controllers/public/donation/PublicDonation'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { toPublicMessagePart } from '@rebel/server/models/chat'
import { DonationWithMessage } from '@rebel/server/stores/DonationStore'

export function donationToPublicObject (donation: DonationWithMessage, linkIdentifier: string, linkedAt: Date | null, linkedUser: PublicUser | null): PublicDonation {
  return {
    id: donation.id,
    time: donation.time.getTime(),
    amount: donation.amount,
    formattedAmount: donation.formattedAmount,
    currency: donation.currency,
    messageParts: donation.messageParts.map(toPublicMessagePart),
    name: donation.name,
    linkIdentifier: linkIdentifier,
    linkedUser: linkedUser ?? null,
    linkedAt: linkedAt?.getTime() ?? null
  }
}
