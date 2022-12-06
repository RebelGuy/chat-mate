import { RankName } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DonationService from '@rebel/server/services/DonationService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import ModService from '@rebel/server/services/rank/ModService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import RankService, { MergeResult } from '@rebel/server/services/rank/RankService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ExperienceStore from '@rebel/server/stores/ExperienceStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { UserAlreadyLinkedToAggregateUserError, LinkAttemptInProgressError } from '@rebel/server/util/error'
import { NO_OP_ASYNC } from '@rebel/server/util/typescript'

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
  }

  /** Links the default user to the aggregate user and performs all required side effects.
   * @throws {@link UserAlreadyLinkedToAggregateUserError}: When the user is already linked to an aggregate user.
   * @throws {@link LinkAttemptInProgressError}: When a link for the user is already in progress. Please wait before creating another one.
  */
  public async linkUser (defaultUserId: number, aggregateUserId: number) {
    const linkAttemptId = await this.linkStore.startLinkAttempt(defaultUserId, aggregateUserId)

    try {
      await this.linkStore.linkUser(defaultUserId, aggregateUserId)
      const connectedUserIds = await this.accountStore.getConnectedChatUserIds(defaultUserId)

      await this.experienceStore.relinkChatExperience(defaultUserId, aggregateUserId)

      if (connectedUserIds.length === 2) {
        // this is a new link - life will be simple
        // don't need to re-apply external punishments, re-apply donations, or re-calculate chat experience data
        await this.rankService.transferRanks(defaultUserId, aggregateUserId)

      } else {
        // at least one other default chat user is already connected to the aggregate user - this will be complicated
        // todo: mergeId should be `linkAttempt-${linkAttemptId}`?
        // todo: do we need to worry about new ranks/messages/xp/donations while the merge is happening? test it out with 10k messages, and see what happens. as long as we don't get a crash, it's probably fine if one or two xp transactions don't get copied over (or similar) - they are not "lost", just assigned to the old user that we aren't using anymore. or if a new xp tx isn't taken into consideration during the recalculation - not a big deal.
        const mergeResults = await this.rankService.mergeRanks(defaultUserId, aggregateUserId, ['donator', 'member', 'supporter'])

        const otherDefaultUserIds = connectedUserIds.filter(userId => userId !== defaultUserId && userId !== aggregateUserId)
        await this.reconciliateExternalRanks(defaultUserId, otherDefaultUserIds, aggregateUserId, mergeResults)

        await this.donationService.reEvaluateDonationRanks(aggregateUserId, `Added as part of the donation rank re-evaluation while linking default user ${defaultUserId} to aggregate user ${aggregateUserId} with attempt id ${linkAttemptId}.`)

        await this.experienceService.recalculateChatExperience(aggregateUserId)
      }


    } catch (e: any) {
      this.logService.logError(this, `Failed to link default user ${defaultUserId} to aggregate user ${aggregateUserId} with attempt id ${linkAttemptId}.`, e)
      await this.linkStore.completeLinkAttempt(linkAttemptId, e.message)
      throw e
    }

    await this.linkStore.completeLinkAttempt(linkAttemptId, null)
  }

  /** Applies external timeouts/bans/mod ranks to the default user so that it is in sync with the aggregate user's external punishment state after the merge. */
  private async reconciliateExternalRanks (oldDefaultUserId: number, otherDefaultUserIds: number[], aggregateUserId: number, mergeResults: MergeResult[]) {
    const allDefaultUserIds = [oldDefaultUserId, ...otherDefaultUserIds]

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
        (_, defaultUsers) => {
          const message = `Added as part of rank merge ${result.mergeId} of user ${oldDefaultUserId} with user ${aggregateUserId}`
          return Promise.all(defaultUsers.map(userId => this.modService.setModRankExternal(userId, result.streamerId!, true, message)))
        }
      )
    }
  }

  /** Revokes the existing rank of the old default user, then of the remaining connected default users, and finally re-applies the rank for all connected default users. */
  private async reconciliateRank (
    rankName: RankName,
    oldDefaultUserId: number,
    otherDefaultUserIds: number[],
    mergeResult: MergeResult,
    onRevokeExternal: (rank: UserRankWithRelations, defaultUsers: number[]) => Promise<any>,
    onApplyExternal: (rank: UserRankWithRelations, defaultUsers: number[]) => Promise<any>
  ): Promise<void> {
    const oldRank = mergeResult.oldRanks.find(r => r.rank.name === rankName)
    if (oldRank != null) {
      await onRevokeExternal(oldRank, [oldDefaultUserId])
    }

    const removeRank = [...mergeResult.extensions, ...mergeResult.unchanged, ...mergeResult.removals].find(r => r.rank.name === rankName)
    if (removeRank != null) {
      await onRevokeExternal(removeRank, otherDefaultUserIds)
    }

    const newRank = [...mergeResult.additions, ...mergeResult.extensions, ...mergeResult.unchanged].find(r => r.rank.name === rankName)
    if (newRank != null) {
      await onApplyExternal(newRank, [oldDefaultUserId, ...otherDefaultUserIds])
    }
  }
}
