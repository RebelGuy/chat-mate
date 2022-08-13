import { Rank, RankName } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { isOneOf } from '@rebel/server/util/validation'

/** Non-special ranks that do not have specific constraints and are not associated with external platforms. */
export type RegularRank = Extract<RankName, 'famous' | 'donator' | 'supporter' | 'member'>

/** Action ranks are ranks that have external meaning/are actionable externally. */
export type SetActionRankResult = {
  rankResult: InternalRankResult
  youtubeResults: YoutubeRankResult[]
  twitchResults: TwitchRankResult[]
}

export type InternalRankResult = { rank: UserRankWithRelations, error: null } | { rank: null, error: string }
export type YoutubeRankResult = { youtubeChannelId: number, error: string | null }
export type TwitchRankResult = { twitchChannelId: number, error: string | null }


type Deps = Dependencies<{
  rankStore: RankStore
}>

export default class RankService extends ContextClass {
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
  }

  public async getAccessibleRanks (): Promise<Rank[]> {
    const ranks = await this.rankStore.getRanks()

    // todo: CHAT-385 use logged-in user details to determine accessible ranks.
    // also create rank hierarchy, so that ranks have only access to ranks on an equal/lower level
    return ranks.filter(rank => isOneOf<RegularRank[]>(rank.name, 'famous', 'donator', 'member', 'supporter') || rank.group === 'punishment' || rank.name === 'mod')
  }
}
