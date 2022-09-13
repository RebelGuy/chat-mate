import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import DonationHelpers, { DonationAmount } from '@rebel/server/helpers/DonationHelpers'
import DonationStore from '@rebel/server/stores/DonationStore'
import RankStore from '@rebel/server/stores/RankStore'
import { single } from '@rebel/server/util/arrays'
import { addTime } from '@rebel/server/util/datetime'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'

type Deps = Dependencies<{
  donationStore: DonationStore
  rankStore: RankStore
  donationHelpers: DonationHelpers
  dateTimeHelpers: DateTimeHelpers
}>

export default class DonationService extends ContextClass {
  private readonly donationStore: DonationStore
  private readonly rankStore: RankStore
  private readonly donationHelpers: DonationHelpers
  private readonly dateTimeHelpers: DateTimeHelpers

  constructor (deps: Deps) {
    super()
    
    this.donationStore = deps.resolve('donationStore')
    this.rankStore = deps.resolve('rankStore')
    this.donationHelpers = deps.resolve('donationHelpers')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
  }

  /** Links the user to the donation and adds all donation ranks that the user is now eligible for.
   * @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (donationId: number, userId: number): Promise<Donation> {
    const time = this.dateTimeHelpers.now()
    const updatedDonation = await this.donationStore.linkUserToDonation(donationId, userId, time)

    const allDonations = await this.donationStore.getDonationsByUserId(userId)
    const donationAmounts = allDonations.map(d => [d.time, d.amount] as DonationAmount)
    const currentRanks = single(await this.rankStore.getUserRanks([userId])).ranks

    const now = new Date()
    const longTermExpiration = addTime(now, 'days', 365 / 2)
    const monthFromNow = addTime(now, 'days', 31)

    if (this.donationHelpers.isEligibleForDonator(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'donator')
      if (existingDonatorRank == null) {
        await this.rankStore.addUserRank({
          rank: 'donator',
          userId: userId,
          expirationTime: longTermExpiration,
          assignee: null,
          message: null,
          time: time
        })
      } else {
        await this.rankStore.updateRankExpiration(existingDonatorRank.id, longTermExpiration)
      }
    }

    if (this.donationHelpers.isEligibleForSupporter(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'supporter')
      if (existingDonatorRank == null) {
        await this.rankStore.addUserRank({
          rank: 'supporter',
          userId: userId,
          expirationTime: longTermExpiration,
          assignee: null,
          message: null,
          time: time
        })
      } else {
        await this.rankStore.updateRankExpiration(existingDonatorRank.id, longTermExpiration)
      }
    }

    if (this.donationHelpers.isEligibleForMember(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'member')
      if (existingDonatorRank == null) {
        await this.rankStore.addUserRank({
          rank: 'member',
          userId: userId,
          expirationTime: monthFromNow,
          assignee: null,
          message: null,
          time: time
        })
      } else {
        await this.rankStore.updateRankExpiration(existingDonatorRank.id, monthFromNow)
      }
    }

    return updatedDonation
  }

  /** Unlinks the user currently linked to the given donation, and removes all donation ranks that the user is no longer eligible for.
  /* @throws {@link DonationUserLinkNotFoundError}: When a link does not exist for the donation. */
  public async unlinkUserFromDonation (donationId: number): Promise<Donation> {
    const [updatedDonation, userId] = await this.donationStore.unlinkUserFromDonation(donationId)

    const allDonations = await this.donationStore.getDonationsByUserId(userId)
    const donationAmounts = allDonations.map(d => [d.time, d.amount] as DonationAmount)
    const currentRanks = single(await this.rankStore.getUserRanks([userId])).ranks
    const now = new Date()
    const removeMessage = `Automatically removed rank because the user was unlinked from donation ${donationId} and no longer meets the requirements for this rank.`

    if (!this.donationHelpers.isEligibleForDonator(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'donator')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'donator', userId: userId, removedBy: null, message: removeMessage })
      }
    }

    if (!this.donationHelpers.isEligibleForSupporter(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'supporter')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'supporter', userId: userId, removedBy: null, message: removeMessage })
      }
    }

    if (!this.donationHelpers.isEligibleForMember(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'member')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'member', userId: userId, removedBy: null, message: removeMessage })
      }
    }

    return updatedDonation
  }
}
