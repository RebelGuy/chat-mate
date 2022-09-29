import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { Entity, New } from '@rebel/server/models/entities'
import { CustomEmojiCreateData, CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'

export function customEmojiToPublicObject (emoji: CustomEmojiWithRankWhitelist): PublicCustomEmoji {
  return {
    schema: 1,
    id: emoji.id,
    name: emoji.name,
    symbol: emoji.symbol,
    imageData: emoji.image.toString('base64'),
    levelRequirement: emoji.levelRequirement,
    whitelistedRanks: emoji.whitelistedRanks
  }
}

export function publicObjectNewToNewCustomEmoji (emoji: PublicCustomEmojiNew): CustomEmojiCreateData {
  return {
    name: emoji.name,
    symbol: emoji.symbol,
    image: Buffer.from(emoji.imageData, 'base64'),
    levelRequirement: emoji.levelRequirement,
    whitelistedRanks: emoji.whitelistedRanks
  }
}

export function publicObjectToCustomEmoji (emoji: PublicCustomEmoji): CustomEmojiWithRankWhitelist {
  return {
    id: emoji.id,
    name: emoji.name,
    symbol: emoji.symbol,
    image: Buffer.from(emoji.imageData, 'base64'),
    levelRequirement: emoji.levelRequirement,
    whitelistedRanks: emoji.whitelistedRanks
  }
}
