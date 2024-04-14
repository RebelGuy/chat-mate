import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import DonationHelpers, { DonationAmount, DONATION_EPOCH_DAYS } from '@rebel/server/helpers/DonationHelpers'
import { ChatItemWithRelations, PartialChatMessage } from '@rebel/server/models/chat'
import AccountService from '@rebel/server/services/AccountService'
import CustomEmojiService from '@rebel/server/services/CustomEmojiService'
import LogService from '@rebel/server/services/LogService'
import StreamlabsProxyService from '@rebel/server/services/StreamlabsProxyService'
import UserService from '@rebel/server/services/UserService'
import DonationStore, { DonationCreateArgs } from '@rebel/server/stores/DonationStore'
import RankStore from '@rebel/server/stores/RankStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { group, single } from '@rebel/shared/util/arrays'
import { addTime, maxTime } from '@rebel/shared/util/datetime'
import { ChatMateError, UserRankAlreadyExistsError } from '@rebel/shared/util/error'
import { CurrencyCode } from '@rebel/server/constants'
import { Donation } from '@prisma/client'

export type DonationWithMessage = Donation & {
  messageParts: ChatItemWithRelations['chatMessageParts']
}

export type DonationWithUser = DonationWithMessage & {
  linkIdentifier: string
  linkedAt: Date | null
  primaryUserId: number | null
}

export type NewDonation = {
  createdAt: number
  currency: CurrencyCode
  amount: number
  formattedAmount: string
  name: string
  message: string | null

  // defined only for streamlabs donations
  streamlabsDonationId: number | null

  // optional, even for streamlabs donations
  streamlabsUserId: number | null
}

type Deps = Dependencies<{
  donationStore: DonationStore
  rankStore: RankStore
  donationHelpers: DonationHelpers
  dateTimeHelpers: DateTimeHelpers
  customEmojiService: CustomEmojiService
  streamlabsProxyService: StreamlabsProxyService
  streamerStore: StreamerStore
  logService: LogService
  accountService: AccountService
  userService: UserService
  isAdministrativeMode: () => boolean
}>

export default class DonationService extends ContextClass {
  public readonly name = DonationService.name

  private readonly donationStore: DonationStore
  private readonly rankStore: RankStore
  private readonly donationHelpers: DonationHelpers
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly customEmojiService: CustomEmojiService
  private readonly streamlabsProxyService: StreamlabsProxyService
  private readonly streamerStore: StreamerStore
  private readonly logService: LogService
  private readonly accountService: AccountService
  private readonly userService: UserService
  private readonly isAdministrativeMode: () => boolean

  constructor (deps: Deps) {
    super()

    this.donationStore = deps.resolve('donationStore')
    this.rankStore = deps.resolve('rankStore')
    this.donationHelpers = deps.resolve('donationHelpers')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.customEmojiService = deps.resolve('customEmojiService')
    this.streamlabsProxyService = deps.resolve('streamlabsProxyService')
    this.streamerStore = deps.resolve('streamerStore')
    this.logService = deps.resolve('logService')
    this.accountService = deps.resolve('accountService')
    this.userService = deps.resolve('userService')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
  }

  public override async initialise () {
    if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

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

  /** Returns the new created donation's ID. */
  public async addDonation (donation: NewDonation, streamerId: number): Promise<number> {
    let messageParts: PartialChatMessage[] = []
    if (donation.message != null && donation.message.trim().length > 0) {
      messageParts = await this.customEmojiService.applyCustomEmojisToDonation(donation.message, streamerId)
    }

    const data: DonationCreateArgs = {
      streamerId: streamerId,
      amount: donation.amount,
      currency: donation.currency,
      formattedAmount: donation.formattedAmount,
      name: donation.name,
      streamlabsId: donation.streamlabsDonationId,
      streamlabsUserId: donation.streamlabsUserId,
      time: new Date(donation.createdAt),
      messageParts: messageParts
    }
    return await this.donationStore.addDonation(data)
  }

  public async getDonation (streamerId: number, donationId: number): Promise<DonationWithUser> {
    const donation = await this.donationStore.getDonation(streamerId, donationId)
    await this.customEmojiService.signEmojiImages(donation.messageParts)
    return donation
  }

  public async getDonationsSince (streamerId: number, time: number, includeRefunded: boolean): Promise<DonationWithUser[]> {
    const donations = await this.donationStore.getDonationsSince(streamerId, time, includeRefunded)
    await Promise.all(donations.map(donation => this.customEmojiService.signEmojiImages(donation.messageParts)))
    return donations
  }

  /** Links the user to the donation and adds all donation ranks that the user is now eligible for.
   * @throws {@link DonationUserLinkAlreadyExistsError}: When a link already exists for the donation. */
  public async linkUserToDonation (streamerId: number, donationId: number, primaryUserId: number): Promise<void> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new ChatMateError('Cannot link the user at this time. Please try again later.')
    }

    const time = this.dateTimeHelpers.now()
    await this.donationStore.linkUserToDonation(streamerId, donationId, primaryUserId, time)

    const allDonations = await this.donationStore.getDonationsByUserIds(streamerId, [primaryUserId], false)
    const donationAmounts = allDonations.map(d => [d.time, d.amount] as DonationAmount)
    const currentRanks = single(await this.rankStore.getUserRanks([primaryUserId], streamerId)).ranks

    const longTermExpiration = addTime(time, 'days', DONATION_EPOCH_DAYS)
    const monthFromNow = addTime(time, 'days', 31)

    if (this.donationHelpers.isEligibleForDonator(donationAmounts, time)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'donator')
      if (existingDonatorRank == null) {
        await this.rankStore.addUserRank({
          rank: 'donator',
          primaryUserId: primaryUserId,
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

    if (this.donationHelpers.isEligibleForSupporter(donationAmounts, time)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'supporter')
      if (existingDonatorRank == null) {
        await this.rankStore.addUserRank({
          rank: 'supporter',
          primaryUserId: primaryUserId,
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

    if (this.donationHelpers.isEligibleForMember(donationAmounts, time)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'member')
      if (existingDonatorRank == null) {
        await this.rankStore.addUserRank({
          rank: 'member',
          primaryUserId: primaryUserId,
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

  /** Re-evaluates and applies eligible donation ranks to the associated primary user, taking into account all connected users across all streamers.
   * Assumes the associated primary user does not currently have any donation ranks.
   * Returns the number of warnings encountered. */
  public async reEvaluateDonationRanks (anyUserId: number, message: string | null, reEvaluationId: string): Promise<number> {
    const time = this.dateTimeHelpers.now()
    const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([anyUserId]).then(single)
    const allDonations = await this.donationStore.getDonationsByUserIds(null, [primaryUserId], false)
    const groupedDonations = group(allDonations, d => d.streamerId)

    let warnings = 0
    for (const { group: streamerId, items: donations } of groupedDonations) {
      if (donations.length === 0) {
        continue
      }

      const donationAmounts = donations.map(d => [d.time, d.amount] as DonationAmount)

      const lastDonationTime = maxTime(...donations.map(d => d.time))
      const longTermExpiration = addTime(lastDonationTime, 'days', DONATION_EPOCH_DAYS)
      const monthFromNow = addTime(lastDonationTime, 'days', 31)

      if (this.donationHelpers.isEligibleForDonator(donationAmounts, time)) {
        try {
          await this.rankStore.addUserRank({
            rank: 'donator',
            primaryUserId: primaryUserId,
            streamerId: streamerId,
            expirationTime: longTermExpiration,
            assignee: null,
            message: message,
            time: time
          })
        } catch (e: any) {
          if (e instanceof UserRankAlreadyExistsError) {
            this.logService.logWarning(this, `[Re-evaluation ${reEvaluationId}] Cannot add rank donator to primary user ${primaryUserId} for streamer ${streamerId} because it already exists`)
            warnings++
          } else {
            throw e
          }
        }
      }

      if (this.donationHelpers.isEligibleForSupporter(donationAmounts, time)) {
        try {
          await this.rankStore.addUserRank({
            rank: 'supporter',
            primaryUserId: primaryUserId,
            streamerId: streamerId,
            expirationTime: longTermExpiration,
            assignee: null,
            message: message,
            time: time
          })
        } catch (e: any) {
          if (e instanceof UserRankAlreadyExistsError) {
            this.logService.logWarning(this, `[Re-evaluation ${reEvaluationId}] Cannot add rank supporter to primary user ${primaryUserId} for streamer ${streamerId} because it already exists`)
            warnings++
          } else {
            throw e
          }
        }
      }

      if (this.donationHelpers.isEligibleForMember(donationAmounts, time)) {
        try {
          await this.rankStore.addUserRank({
            rank: 'member',
            primaryUserId: primaryUserId,
            streamerId: streamerId,
            expirationTime: monthFromNow,
            assignee: null,
            message: message,
            time: time
          })
        } catch (e: any) {
          if (e instanceof UserRankAlreadyExistsError) {
            this.logService.logWarning(this, `[Re-evaluation ${reEvaluationId}] Cannot add rank member to primary user ${primaryUserId} for streamer ${streamerId} because it already exists`)
            warnings++
          } else {
            throw e
          }
        }
      }
    }

    return warnings
  }

  /** Unlinks the user currently linked to the given donation, and removes all donation ranks that the primary user is no longer eligible for.
  /* @throws {@link DonationUserLinkNotFoundError}: When a link does not exist for the donation. */
  public async unlinkUserFromDonation (streamerId: number, donationId: number): Promise<void> {
    const donation = await this.donationStore.getDonation(streamerId, donationId)
    if (donation.primaryUserId != null && await this.userService.isUserBusy(donation.primaryUserId)) {
      throw new ChatMateError('Cannot unlink the user at this time. Please try again later.')
    }

    const primaryUserId = await this.donationStore.unlinkUserFromDonation(streamerId, donationId)

    const allDonations = await this.donationStore.getDonationsByUserIds(streamerId, [primaryUserId], false)
    const donationAmounts = allDonations.map(d => [d.time, d.amount] as DonationAmount)
    const currentRanks = single(await this.rankStore.getUserRanks([primaryUserId], streamerId)).ranks
    const now = new Date()
    const removeMessage = `Automatically removed rank because the user was unlinked from donation ${donationId} and no longer meets the requirements for this rank.`

    if (!this.donationHelpers.isEligibleForDonator(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'donator')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'donator', primaryUserId: primaryUserId, streamerId, removedBy: null, message: removeMessage })
      }
    }

    if (!this.donationHelpers.isEligibleForSupporter(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'supporter')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'supporter', primaryUserId: primaryUserId, streamerId, removedBy: null, message: removeMessage })
      }
    }

    if (!this.donationHelpers.isEligibleForMember(donationAmounts, now)) {
      const existingDonatorRank = currentRanks.find(r => r.rank.name === 'member')
      if (existingDonatorRank != null) {
        await this.rankStore.removeUserRank({ rank: 'member', primaryUserId: primaryUserId, streamerId, removedBy: null, message: removeMessage })
      }
    }
  }
}
