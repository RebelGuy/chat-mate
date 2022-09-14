import { RankName } from '@prisma/client'
import ContextClass from '@rebel/server/context/ContextClass'
import { sum } from '@rebel/server/util/math'

export type DonationAmount = [date: Date, amount: number]

export type DonationRank = Extract<RankName, 'donator' | 'supporter' | 'member'>

export const DONATION_EPOCH_DAYS = 365 / 2

// todo: ideally this should take into account the currency, since 50 units can have drastically different valuations amongst different currencies
const SUPPORTER_TOTAL_DONATION = 50

const MEMBER_CONSECUTIVE_MONTHS = 3

const TIME_THRESHOLD = DONATION_EPOCH_DAYS * 24 * 3600 * 1000

export default class DonationHelpers extends ContextClass {
  public isEligibleForDonator (donations: DonationAmount[], now: Date): boolean {
    donations = filterEligibleDonations(donations, now)
    return donations.length > 0
  }

  public isEligibleForSupporter (donations: DonationAmount[], now: Date): boolean {
    donations = filterEligibleDonations(donations, now)
    return sum(donations.map(d => d[1])) >= SUPPORTER_TOTAL_DONATION
  }

  public isEligibleForMember (donations: DonationAmount[], now: Date): boolean {
    donations = filterEligibleDonations(donations, now)
    if (donations.length <= 1) {
      return false
    }

    const monthMs = (365.25 / 12) * 24 * 3600 * 1000
    const times = donations.map(d => d[0].getTime()).sort().reverse()
    
    // last donation must have been made within the last month
    if (now.getTime() - times[0] > monthMs) {
      return false
    }
    
    // check if the last donations form a chain at least 3 months long with no more than 1 month between each donations
    let chainLength = 0
    for (let i = 1; i < times.length; i++) {
      const difference = times[i] - times[i - 1]
      if (difference > monthMs) {
        return false
      } else {
        chainLength += difference
      }

      if (chainLength >= monthMs * MEMBER_CONSECUTIVE_MONTHS) {
        return true
      }
    }

    return false
  }
}

function filterEligibleDonations (donations: DonationAmount[], now: Date): DonationAmount[] {
  return donations.filter(d => d[0].getTime() >= now.getTime() - TIME_THRESHOLD)
}
