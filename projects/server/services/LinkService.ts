import { RankName } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DonationService from '@rebel/server/services/DonationService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import ModService from '@rebel/server/services/rank/ModService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import RankService, { MergeResult, SetActionRankResult } from '@rebel/server/services/rank/RankService'
import AccountStore from '@rebel/server/stores/AccountStore'
import DonationStore from '@rebel/server/stores/DonationStore'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError, UserAlreadyLinkedToAggregateUserError, UserNotLinkedError } from '@rebel/shared/util/error'
import { NO_OP_ASYNC } from '@rebel/shared/util/typescript'
import { nameof } from '@rebel/shared/testUtils'
import { MAX_CHANNEL_LINKS_ALLOWED } from '@rebel/shared/constants'
import { SafeOmit } from '@rebel/shared/types'

export type LinkLog = [time: Date, step: string, warnings: number]

export type UnlinkUserOptions = {
  /** If true, will copy any ranks that the aggregate user had to the default user (does not include external ranks). */
  transferRanks: boolean

  /** If true, will relink back to this user any chat experience that the user was originally associated with at the time of linking. */
  relinkChatExperience: boolean

  /** If true, will relink back to this user any donations that the user was originally associated with at the time of linking. */
  relinkDonations: boolean
}

type Deps = Dependencies<{
  logService: LogService
  accountStore: AccountStore
  rankService: RankService
  linkStore: LinkStore
  experienceStore: ExperienceStore
  punishmentService: PunishmentService
  donationService: DonationService
  experienceService: ExperienceService
  modService: ModService
  donationStore: DonationStore
  rankStore: RankStore
  streamerChannelStore: StreamerChannelStore
  streamerStore: StreamerStore
}>

export default class LinkService extends ContextClass {
  public readonly name = LinkService.name

  private readonly logService: LogService
  private readonly accountStore: AccountStore
  private readonly rankService: RankService
  private readonly linkStore: LinkStore
  private readonly experienceStore: ExperienceStore
  private readonly punishmentService: PunishmentService
  private readonly donationService: DonationService
  private readonly experienceService: ExperienceService
  private readonly modService: ModService
  private readonly donationStore: DonationStore
  private readonly rankStore: RankStore
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly streamerStore: StreamerStore

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.accountStore = deps.resolve('accountStore')
    this.rankService = deps.resolve('rankService')
    this.linkStore = deps.resolve('linkStore')
    this.experienceStore = deps.resolve('experienceStore')
    this.punishmentService = deps.resolve('punishmentService')
    this.donationService = deps.resolve('donationService')
    this.experienceService = deps.resolve('experienceService')
    this.modService = deps.resolve('modService')
    this.donationStore = deps.resolve('donationStore')
    this.rankStore = deps.resolve('rankStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.streamerStore = deps.resolve('streamerStore')
  }

  /** Links the default user to the aggregate user and performs all required side effects.
   * LinkToken should be defined when linking as part of a command, and can be null otherwise.
   * @throws {@link UserAlreadyLinkedToAggregateUserError}: When the user is already linked to an aggregate user.
   * @throws {@link LinkAttemptInProgressError}: When a link for the user is already in progress, or if a previous attempt had failed and was not released. Please wait before creating another attempt, or release the failed attempt.
  */
  public async linkUser (defaultUserId: number, aggregateUserId: number, linkToken: string | null) {
    const linkAttemptId = await this.linkStore.startLinkAttempt(defaultUserId, aggregateUserId)
    let cumWarnings = 0
    let logs: LinkLog[] = [[new Date(), 'Start', cumWarnings]]
    let hasLinkedUser = false

    try {
      if (linkToken != null) {
        await this.linkStore.addLinkAttemptToLinkToken(linkToken, linkAttemptId)
      }

      await this.linkStore.linkUser(defaultUserId, aggregateUserId)
      logs.push([new Date(), nameof(LinkStore, 'linkUser'), cumWarnings])
      hasLinkedUser = true

      // note that the first user represents the aggregate user.
      const connectedUserIds = single(await this.accountStore.getConnectedChatUserIds([defaultUserId])).connectedChatUserIds
      if (connectedUserIds.length > MAX_CHANNEL_LINKS_ALLOWED + 1) {
        throw new ChatMateError(`Only a maximum of ${MAX_CHANNEL_LINKS_ALLOWED} channels can be linked to an account.`)
      }

      await this.experienceStore.invalidateSnapshots([defaultUserId, aggregateUserId])
      logs.push([new Date(), nameof(ExperienceStore, 'invalidateSnapshots'), cumWarnings])

      await this.experienceStore.relinkChatExperience(defaultUserId, aggregateUserId)
      logs.push([new Date(), nameof(ExperienceStore, 'relinkChatExperience'), cumWarnings])

      await this.donationStore.relinkDonation(defaultUserId, aggregateUserId)
      logs.push([new Date(), nameof(DonationStore, 'relinkDonation'), cumWarnings])

      await this.rankStore.relinkAdminUsers(defaultUserId, aggregateUserId)
      logs.push([new Date(), nameof(RankStore, 'relinkAdminUsers'), cumWarnings])

      if (connectedUserIds.length === 2) {
        // this is a new link - life will be simple
        // don't need to re-apply external punishments, re-apply donations, or re-calculate chat experience data
        // we don't strictly need to revoke the old user's ranks, as we will never query those while the new link is in place.
        // however, if we ever were to unlink the user, it's easier to start from a clean state where the original user has no active ranks associated with it.
        cumWarnings += await this.rankService.transferRanks(defaultUserId, aggregateUserId, `link attempt ${linkAttemptId}`, true, [])
        logs.push([new Date(), nameof(RankService, 'transferRanks'), cumWarnings])

      } else {
        // at least one other default chat user is already connected to the aggregate user - this will be complicated
        // todo: do we need to worry about new ranks/messages/xp/donations while the merge is happening? test it out with 10k messages, and see what happens. as long as we don't get a crash, it's probably fine if one or two xp transactions don't get copied over (or similar) - they are not "lost", just assigned to the old user that we aren't using anymore. or if a new xp tx isn't taken into consideration during the recalculation - not a big deal.
        const mergeResults = await this.rankService.mergeRanks(defaultUserId, aggregateUserId, ['donator', 'member', 'supporter'], `link attempt ${linkAttemptId}`)
        cumWarnings += mergeResults.warnings
        logs.push([new Date(), nameof(RankService, 'mergeRanks'), cumWarnings])

        const otherDefaultUserIds = connectedUserIds.filter(userId => userId !== defaultUserId && userId !== aggregateUserId)
        cumWarnings += await this.reconciliateExternalRanks(defaultUserId, otherDefaultUserIds, aggregateUserId, mergeResults.individualResults)
        logs.push([new Date(), 'reconciliateExternalRanks', cumWarnings])

        cumWarnings += await this.donationService.reEvaluateDonationRanks(aggregateUserId, `Added as part of the donation rank re-evaluation while linking default user ${defaultUserId} to aggregate user ${aggregateUserId} with attempt id ${linkAttemptId}.`, `link attempt ${linkAttemptId}`)
        logs.push([new Date(), nameof(DonationService, 'reEvaluateDonationRanks'), cumWarnings])

        await this.experienceService.recalculateChatExperience(aggregateUserId)
        logs.push([new Date(), nameof(ExperienceService, 'recalculateChatExperience'), cumWarnings])
      }

      await this.rankStore.relinkCustomRankNames(defaultUserId, aggregateUserId)
      logs.push([new Date(), nameof(RankStore, 'relinkCustomRankNames'), cumWarnings])

      await this.rankStore.relinkRankEvents(defaultUserId, aggregateUserId)
      logs.push([new Date(), nameof(RankStore, 'relinkRankEvents'), cumWarnings])

    } catch (e: any) {
      this.logService.logError(this, `[${linkAttemptId}] Failed to link default user ${defaultUserId} to aggregate user ${aggregateUserId} with attempt id ${linkAttemptId}. Current warnings: ${cumWarnings}. Logs:`, logs, 'Error:', e)

      if (e instanceof UserAlreadyLinkedToAggregateUserError && linkToken == null) {
        // don't pollute the link history by admin-triggered link attempts failing due to already-linked errors
        await this.linkStore.deleteLinkAttempt(linkAttemptId)
      } else {
        if (hasLinkedUser) {
          try {
            await this.linkStore.unlinkUser(defaultUserId)
            logs.push([new Date(), nameof(LinkStore, 'unlinkUser'), cumWarnings])
            this.logService.logInfo(this, `Successfully rolled back link between default user ${defaultUserId} to aggregate user ${aggregateUserId}`)
          } catch (innerErr: any) {
            this.logService.logInfo(this, `Failed to roll back link between default user ${defaultUserId} to aggregate user ${aggregateUserId}`)
          }
        }

        await this.linkStore.completeLinkAttempt(linkAttemptId, logs, e.message)
      }
      throw e
    }

    await this.linkStore.completeLinkAttempt(linkAttemptId, logs, null)
  }

  /** Unlinks the specified default user from the aggregate user that it is currently linked to.
   * If the default user was the only linked user, we can restore the unlinked state completely. Otherwise, only the state specified in the options will be restored.
   * Does NOT reconciliate external ranks in any way - this is up to the admin to take care of.
   * @throws {@link UserNotLinkedError}: When the user is not linked to an aggregate user.
   * @throws {@link LinkAttemptInProgressError}: When a link for the user is already in progress, or if a previous attempt had failed and was not released. Please wait before creating another attempt, or release the failed attempt
   */
  public async unlinkUser (defaultUserId: number, options: UnlinkUserOptions) {
    const linkAttemptId = await this.linkStore.startUnlinkAttempt(defaultUserId)
    let cumWarnings = 0
    let logs: LinkLog[] = [[new Date(), 'Start', cumWarnings]]
    let aggregateUserId: number

    try {
      const registeredUserResult = await this.accountStore.getRegisteredUsers([defaultUserId]).then(single)
      if (registeredUserResult.registeredUser != null) {
        const streamer = await this.streamerStore.getStreamerByRegisteredUserId(registeredUserResult.registeredUser.id)
        if (streamer != null) {
          const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([streamer!.id]).then(single)
          if (primaryChannels.twitchChannel?.defaultUserId === defaultUserId || primaryChannels.youtubeChannel?.defaultUserId === defaultUserId) {
            throw new ChatMateError(`Cannot unlink default channel ${defaultUserId} because it is a primary channel for streamer ${streamer.id}.`)
          } else {
            logs.push([new Date(), 'Ensured channel is not a primary channel for the streamer', cumWarnings])
          }
        }
      }

      aggregateUserId = await this.linkStore.unlinkUser(defaultUserId)
      logs.push([new Date(), nameof(LinkStore, 'unlinkUser'), cumWarnings])

      if (options.relinkChatExperience) {
        await this.experienceStore.invalidateSnapshots([defaultUserId, aggregateUserId])
        logs.push([new Date(), nameof(ExperienceStore, 'invalidateSnapshots'), cumWarnings])

        await this.experienceStore.undoChatExperienceRelink(defaultUserId)
        logs.push([new Date(), nameof(ExperienceStore, 'undoChatExperienceRelink'), cumWarnings])
      }

      if (options.relinkDonations) {
        await this.donationStore.undoDonationRelink(defaultUserId)
        logs.push([new Date(), nameof(DonationStore, 'undoDonationRelink'), cumWarnings])
      }

      if (options.transferRanks) {
        // need to check the aggregate user becauuse the default user has already been unlinked
        const connectedUserIds = single(await this.accountStore.getConnectedChatUserIds([aggregateUserId])).connectedChatUserIds

        if (connectedUserIds.length === 1) {
          // we unlinked the only user.
          // we do not transfer the owner rank because it would leave the default user with an owner rank and,
          // if linked to another user, would give them automatic owner rank for the other user.
          // instead, the owner rank will get terminated and the user will have to re-apply if desired.
          cumWarnings += await this.rankService.transferRanks(aggregateUserId, defaultUserId, `link attempt ${linkAttemptId}`, true, ['owner'])
          logs.push([new Date(), nameof(RankService, 'transferRanks'), cumWarnings])

        } else {
          // at least one other default chat user is still connected to the aggregate user.
          // importantly, leave the existing aggregate user's ranks intact
          cumWarnings += await this.rankService.transferRanks(aggregateUserId, defaultUserId, `link attempt ${linkAttemptId}`, false, ['owner'])
          logs.push([new Date(), nameof(RankService, 'transferRanks'), cumWarnings])
        }
      }

    } catch (e: any) {
      this.logService.logError(this, `[${linkAttemptId}] Failed to unlink default user ${defaultUserId} from aggregate user ${aggregateUserId! ?? 'n/a'} with attempt id ${linkAttemptId}. Current warnings: ${cumWarnings}. Logs:`, logs, 'Error:', e)

      if (e instanceof UserNotLinkedError) {
        await this.linkStore.deleteLinkAttempt(linkAttemptId)
      } else {
        await this.linkStore.completeLinkAttempt(linkAttemptId, logs, e.message)
      }
      throw e
    }

    await this.linkStore.completeLinkAttempt(linkAttemptId, logs, null)
  }

  /** Applies external timeouts/bans/mod ranks to the default user so that it is in sync with the aggregate user's external punishment state after the merge.
   * Returns the number of warnings encountered. */
  private async reconciliateExternalRanks (oldDefaultUserId: number, otherDefaultUserIds: number[], aggregateUserId: number, mergeResults: MergeResult[]): Promise<number> {
    let warnings = 0

    // deliberately do these in series, we don't want to get rate limited
    for (const result of mergeResults) {
      // we know there are no global ranks with external side effects
      if (result.streamerId == null) {
        continue
      }

      // revoke the old external timeouts. this is mainly done so we stop listening to the YT refresh timer, since Twitch timeouts stack just fine
      await this.reconciliateRank(
        'timeout',
        oldDefaultUserId,
        otherDefaultUserIds,
        result,
        (rank, defaultUsers) => {
          const message = `Revoked as part of rank merge ${result.mergeId} of user ${oldDefaultUserId} with user ${aggregateUserId}`
          return Promise.all(defaultUsers.map(userId => this.punishmentService.untimeoutUserExternal(userId, result.streamerId!, rank.id, message)))
        },
        (rank, defaultUsers) => {
          const durationSeconds = Math.round((rank.expirationTime!.getTime() - Date.now()) / 1000)
          const message = `Added as part of rank merge ${result.mergeId} of user ${oldDefaultUserId} with user ${aggregateUserId}`
          return Promise.all(defaultUsers.map(userId => this.punishmentService.timeoutUserExternal(userId, result.streamerId!, rank.id, message, durationSeconds)))
        }
      )

      // if either side of the merge had a ban or mod, all connected users will end up getting banned or modded. no need to first remove them - nothing will go wrong if they are re-applied, especially since they are permanent externally
      await this.reconciliateRank(
        'ban',
        oldDefaultUserId,
        otherDefaultUserIds,
        result,
        NO_OP_ASYNC,
        (_, defaultUsers) => {
          const message = `Added as part of rank merge ${result.mergeId} of user ${oldDefaultUserId} with user ${aggregateUserId}`
          return Promise.all(defaultUsers.map(userId => this.punishmentService.banUserExternal(userId, result.streamerId!, message)))
        }
      )

      await this.reconciliateRank(
        'mod',
        oldDefaultUserId,
        otherDefaultUserIds,
        result,
        NO_OP_ASYNC,
        (_, defaultUsers) => Promise.all(defaultUsers.map(userId => this.modService.setModRankExternal(userId, result.streamerId!, true)))
      )
    }

    return warnings
  }

  /** Revokes the existing rank of the old default user, then of the remaining connected default users, and finally re-applies the rank for all connected default users.
   * Returns the number of warnings. */
  private async reconciliateRank (
    rankName: RankName,
    oldDefaultUserId: number,
    otherDefaultUserIds: number[],
    mergeResult: MergeResult,
    onRevokeExternal: (rank: UserRankWithRelations, defaultUsers: number[]) => Promise<(SafeOmit<SetActionRankResult, 'rankResult'> | void)[] | void>,
    onApplyExternal: (rank: UserRankWithRelations, defaultUsers: number[]) => Promise<(SafeOmit<SetActionRankResult, 'rankResult'> | void)[] | void>
  ): Promise<number> {
    let warnings = 0

    const oldRank = mergeResult.oldRanks.find(r => r.rank.name === rankName)
    if (oldRank != null) {
      const result = await onRevokeExternal(oldRank, [oldDefaultUserId])
      warnings += getWarnings(result)
    }

    // extensions and unchanged ranks are removed and then re-applied so that we can be sure the state is consistent
    const removeRank = [...mergeResult.extensions, ...mergeResult.unchanged, ...mergeResult.removals].find(r => r.rank.name === rankName)
    if (removeRank != null) {
      const result = await onRevokeExternal(removeRank, otherDefaultUserIds)
      warnings += getWarnings(result)
    }

    const newRank = [...mergeResult.additions, ...mergeResult.extensions, ...mergeResult.unchanged].find(r => r.rank.name === rankName)
    if (newRank != null) {
      const result = await onApplyExternal(newRank, [oldDefaultUserId, ...otherDefaultUserIds])
      warnings += getWarnings(result)
    }

    return warnings
  }
}

/** Gets the number of warnings from the external action results. */
function getWarnings (result: (SafeOmit<SetActionRankResult, 'rankResult'> | void)[] | void): number {
  if (result == null) {
    return 0
  } else {
    return (result.filter(r => r != null) as SafeOmit<SetActionRankResult, 'rankResult'>[])
      .flatMap(r => [
        ...r.twitchResults.filter(x => x.error != null),
        ...r.youtubeResults.filter(x => x.error != null)
      ]).length
  }
}
