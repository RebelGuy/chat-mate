import ContextClass from '@rebel/server/context/ContextClass'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'

export default class RankHelpers extends ContextClass {
  /** Checks if the given rank is currently active, or whether it was active at the provided time. */
  public isRankActive (rank: UserRankWithRelations, atTime: Date = new Date()): boolean {
    return rank.issuedAt <= atTime && (rank.expirationTime == null || rank.expirationTime > atTime) && (rank.revokedTime == null || rank.revokedTime > atTime)
  }
}
