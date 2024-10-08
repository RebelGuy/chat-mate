import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import ExperienceService, { UserLevel } from '@rebel/server/services/ExperienceService'
import CustomEmojiStore, { CurrentCustomEmoji, CustomEmojiWhitelistedRanks, CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import RankStore, { UserRanks } from '@rebel/server/stores/RankStore'
import { single, intersection } from '@rebel/shared/util/arrays'

type Deps = Dependencies<{
  experienceService: ExperienceService
  rankStore: RankStore
  customEmojiStore: CustomEmojiStore
}>

export default class CustomEmojiEligibilityService extends ContextClass {
  private readonly experienceService: ExperienceService
  private readonly rankStore: RankStore
  private readonly customEmojiStore: CustomEmojiStore

  constructor (deps: Deps) {
    super()
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.customEmojiStore = deps.resolve('customEmojiStore')
  }

  public async getEligibleEmojis (primaryUserId: number, streamerId: number): Promise<CurrentCustomEmoji[]> {
    const levelPromise = this.experienceService.getLevels(streamerId, [primaryUserId])
    const userRanksPromise = this.rankStore.getUserRanks([primaryUserId], streamerId)
    const allEmojis = await this.customEmojiStore.getAllCustomEmojis(streamerId)
    const allEmojiIds = allEmojis.map(e => e.id)
    const whitelistedRanksPromise = this.customEmojiStore.getCustomEmojiWhitelistedRanks(allEmojiIds)
    const level = single(await levelPromise)
    const whitelistedRanks = await whitelistedRanksPromise
    const userRanks = single(await userRanksPromise)

    return allEmojis.filter(e =>
      this.levelEligibilityCheck(e, level) &&
      this.rankEligibilityCheck(userRanks, whitelistedRanks.find(wr => wr.emojiId === e.id)!)
    ).map(e => ({ id: e.id, symbol: e.symbol, streamerId: e.streamerId, sortOrder: e.sortOrder, latestVersion: e.version, deletedAt: e.deletedAt }))
  }

  public async getEligibleDonationEmojis (streamerId: number): Promise<CurrentCustomEmoji[]> {
    const allEmojis = await this.customEmojiStore.getAllCustomEmojis(streamerId)
    return allEmojis.filter(e => e.canUseInDonationMessage)
      .map(e => ({ id: e.id, symbol: e.symbol, streamerId: e.streamerId, sortOrder: e.sortOrder, latestVersion: e.version, deletedAt: e.deletedAt }))
  }

  private levelEligibilityCheck (emoji: CustomEmojiWithRankWhitelist, userLevel: UserLevel) {
    return userLevel.level.level >= emoji.levelRequirement
  }

  private rankEligibilityCheck (userRanks: UserRanks, emojiRankWhitelist: CustomEmojiWhitelistedRanks) {
    // the absence of whitelisted ranks implies that all ranks have access to the emoji
    if (emojiRankWhitelist.rankIds.length === 0) {
      return true
    }

    return intersection(userRanks.ranks.map(r => r.rank.id), emojiRankWhitelist.rankIds).length > 0
  }
}
