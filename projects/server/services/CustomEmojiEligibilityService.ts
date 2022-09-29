import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { Entity } from '@rebel/server/models/entities'
import ExperienceService, { UserLevel } from '@rebel/server/services/ExperienceService'
import CustomEmojiStore, { EmojiRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import RankStore, { UserRanks } from '@rebel/server/stores/RankStore'
import { single, intersection } from '@rebel/server/util/arrays'

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

  public async getEligibleEmojis (userId: number): Promise<CustomEmoji[]> {
    const levelPromise = this.experienceService.getLevels([userId])
    const userRanksPromise = this.rankStore.getUserRanks([userId])
    const allEmojis = await this.customEmojiStore.getAllCustomEmojis()
    const allEmojiIds = allEmojis.map(e => e.id)
    const whitelistedRanksPromise = this.customEmojiStore.getCustomEmojiWhitelistedRanks(allEmojiIds)
    const level = single(await levelPromise)
    const whitelistedRanks = await whitelistedRanksPromise
    const userRanks = single(await userRanksPromise)

    return allEmojis.filter(e =>
      this.levelEligibilityCheck(e, level) &&
      this.rankEligibilityCheck(userRanks, whitelistedRanks.find(wr => wr.emojiId === e.id)!)
    )
  }

  private levelEligibilityCheck (emoji: Entity.CustomEmoji, userLevel: UserLevel) {
    return userLevel.level.level >= emoji.levelRequirement
  }

  private rankEligibilityCheck (userRanks: UserRanks, emojiRankWhitelist: EmojiRankWhitelist) {
    // the absence of whitelisted ranks implies that all ranks have access to the emoji
    if (emojiRankWhitelist.rankIds.length === 0) {
      return true
    }

    return intersection(userRanks.ranks.map(r => r.rank.id), emojiRankWhitelist.rankIds).length > 0
  }
}