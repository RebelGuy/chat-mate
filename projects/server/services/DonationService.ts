import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import DonationHelpers, { DonationAmount, DONATION_EPOCH_DAYS } from '@rebel/server/helpers/DonationHelpers'
import { PartialChatMessage } from '@rebel/server/models/chat'
import EmojiService from '@rebel/server/services/EmojiService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import DonationStore, { DonationCreateArgs } from '@rebel/server/stores/DonationStore'
import RankStore from '@rebel/server/stores/RankStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/server/util/arrays'
import { addTime } from '@rebel/server/util/datetime'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'

type Deps = Dependencies<{
  donationStore: DonationStore
  rankStore: RankStore
  donationHelpers: DonationHelpers
  dateTimeHelpers: DateTimeHelpers
  emojiService: EmojiService
  streamlabsProxyService: StreamlabsProxyService
  streamerStore: StreamerStore
}>

export default class DonationService extends ContextClass {
  private readonly donationStore: DonationStore
  private readonly rankStore: RankStore
  private readonly donationHelpers: DonationHelpers
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly emojiService: EmojiService
  private readonly streamlabsProxyService: StreamlabsProxyService
  private readonly streamerStore: StreamerStore

  constructor (deps: Deps) {
    super()

    this.donationStore = deps.resolve('donationStore')
    this.rankStore = deps.resolve('rankStore')
    this.donationHelpers = deps.resolve('donationHelpers')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.emojiService = deps.resolve('emojiService')
    this.streamlabsProxyService = deps.resolve('streamlabsProxyService')
    this.streamerStore = deps.resolve('streamerStore')
  }

  public override async initialise () {
    const streamers = await this.streamerStore.getStreamers()

    // todo: this doesn't scale
    const tokens = await Promise.all(streamers.map(streamer => this.donationStore.getStreamlabsSocketToken(streamer.id)))

    for (const token of tokens) {
      if (token == null) {
        continue
      }

      this.streamlabsProxyService.listenToStreamerDonations(token.streamerId, token.token)
    }
  }

  public async addDonation (donation: StreamlabsDonation, streamerId: number) {
    let messageParts: PartialChatMessage[] = []
    if (donation.message != null && donation.message.trim().length > 0) {
      messageParts = await this.emojiService.applyCustomEmojisToDonation(donation.message, streamerId)
    }

    const data: DonationCreateArgs = {
      streamerId: streamerId,
      amount: donation.amount,
      currency: donation.currency,
      formattedAmount: donation.formattedAmount,
      name: donation.name,
      streamlabsId: donation.donationId,
      streamlabsUserId: donation.streamlabsUserId,
      time: new Date(donation.createdAt),
      messageParts: messageParts
    }
    await this.donationStore.addDonation(data)
  }

  /** Links the user to the donation and adds all donation ranks that the user is now eligible for.
   * @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (donationId: number, userId: number, streamerId: number): Promise<void> {
    const time = this.dateTimeHelpers.now()
    await this.donationStore.linkUserToDonation(donationId, userId, time)

    const allDonations = await this.donationStore.getDonationsByUserId(streamerId, userId)
    const donationAmounts = allDonations.map(d => [d.time, d.amount] as DonationAmount)
    const currentRanks = single(await this.rankStore.getUserRanks([userId], streamerId)).ranks

    const now = new Date()
    const longTermExpiration = addTime(now, 'days', DONATION_EPOCH_DAYS)
    const monthFromNow = addTime(now, 'days', 31)

    if (this.donationHelpers.isEligibleForDonator(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'donator')
      if (existingDonatorRank == null) {
        await this.rankStore.addUserRank({
          rank: 'donator',
          userId: userId,
          streamerId: streamerId,
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
          streamerId: streamerId,
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
          streamerId: streamerId,
          expirationTime: monthFromNow,
          assignee: null,
          message: null,
          time: time
        })
      } else {
        await this.rankStore.updateRankExpiration(existingDonatorRank.id, monthFromNow)
      }
    }
  }

  /** Returns true if the socket token has been updated, and false if the provided socket token is the same as the existing token. */
  public async setStreamlabsSocketToken (streamerId: number, streamlabsSocketToken: string | null): Promise<boolean> {
    const hasUpdated = await this.donationStore.setStreamlabsSocketToken(streamerId, streamlabsSocketToken)

    if (hasUpdated) {
      if (streamlabsSocketToken != null) {
        this.streamlabsProxyService.listenToStreamerDonations(streamerId, streamlabsSocketToken)
      } else {
        this.streamlabsProxyService.stopListeningToStreamerDonations(streamerId)
      }
    }

    return hasUpdated
  }

  public getStreamlabsStatus (streamerId: number): 'notListening' | 'listening' | 'error' {
    const socket = this.streamlabsProxyService.getWebsocket(streamerId)
    if (socket == null) {
      return 'notListening'
    } else if (socket.connected) {
      return 'listening'
    } else {
      return 'error'
    }
  }

  /** Unlinks the user currently linked to the given donation, and removes all donation ranks that the user is no longer eligible for.
  /* @throws {@link DonationUserLinkNotFoundError}: When a link does not exist for the donation. */
  public async unlinkUserFromDonation (donationId: number, streamerId: number): Promise<void> {
    const userId = await this.donationStore.unlinkUserFromDonation(donationId)

    const allDonations = await this.donationStore.getDonationsByUserId(streamerId, userId)
    const donationAmounts = allDonations.map(d => [d.time, d.amount] as DonationAmount)
    const currentRanks = single(await this.rankStore.getUserRanks([userId], streamerId)).ranks
    const now = new Date()
    const removeMessage = `Automatically removed rank because the user was unlinked from donation ${donationId} and no longer meets the requirements for this rank.`

    if (!this.donationHelpers.isEligibleForDonator(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'donator')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'donator', userId: userId, streamerId, removedBy: null, message: removeMessage })
      }
    }

    if (!this.donationHelpers.isEligibleForSupporter(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'supporter')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'supporter', userId: userId, streamerId, removedBy: null, message: removeMessage })
      }
    }

    if (!this.donationHelpers.isEligibleForMember(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'member')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'member', userId: userId, streamerId, removedBy: null, message: removeMessage })
      }
    }
  }
}
