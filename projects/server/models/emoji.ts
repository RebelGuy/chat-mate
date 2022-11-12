import { PublicCustomEmoji, PublicCustomEmojiNew, PublicCustomEmojiUpdate } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { CustomEmojiCreateData, CustomEmojiUpdateData, CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'

export function customEmojiToPublicObject (emoji: CustomEmojiWithRankWhitelist): PublicCustomEmoji {
  return {
    schema: 1,
    id: emoji.id,
    name: emoji.name,
    symbol: emoji.symbol,
    version: emoji.version,
    isActive: emoji.isActive,
    imageData: emoji.image.toString('base64'),
    levelRequirement: emoji.levelRequirement,
    canUseInDonationMessage: emoji.canUseInDonationMessage,
    whitelistedRanks: emoji.whitelistedRanks
  }
}

export function publicObjectNewToNewCustomEmoji (emoji: PublicCustomEmojiNew, streamerId: number): CustomEmojiCreateData {
  return {
    name: emoji.name,
    symbol: emoji.symbol,
    streamerId: streamerId,
    image: Buffer.from(emoji.imageData, 'base64'),
    levelRequirement: emoji.levelRequirement,
    canUseInDonationMessage: emoji.canUseInDonationMessage,
    whitelistedRanks: emoji.whitelistedRanks
  }
}

export function publicObjectToCustomEmojiUpdateData (emoji: PublicCustomEmojiUpdate): CustomEmojiUpdateData {
  return {
    id: emoji.id,
    name: emoji.name,
    image: Buffer.from(emoji.imageData, 'base64'),
    levelRequirement: emoji.levelRequirement,
    canUseInDonationMessage: emoji.canUseInDonationMessage,
    whitelistedRanks: emoji.whitelistedRanks
  }
}
