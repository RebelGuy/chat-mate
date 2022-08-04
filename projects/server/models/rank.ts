import { UserRankWithRelations } from '@rebel/server/stores/RankStore'

export function isRankActive (rank: UserRankWithRelations): boolean {
  return (rank.expirationTime == null || rank.expirationTime > new Date()) && rank.revokedTime == null
}
