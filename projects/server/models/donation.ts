import { PublicDonation } from '@rebel/api-models/public/donation/PublicDonation'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { toPublicMessagePart } from '@rebel/server/models/chat'
import { DonationWithMessage } from '@rebel/server/services/DonationService'

/** It is expected that all relative URLs are resolved and signed, or marked as inaccessible. */
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
    linkedAt: linkedAt?.getTime() ?? null,
    refundedAt: donation.refundedAt?.getTime() ?? null,
    deletedAt: donation.deletedAt?.getTime() ?? null
  }
}
