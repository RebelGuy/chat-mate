import { PublicCustomEmoji } from '@rebel/api-models/public/emoji/PublicCustomEmoji'
import { PublicCustomEmojiNew } from '@rebel/api-models/public/emoji/PublicCustomEmojiNew'
import { PublicCustomEmojiUpdate } from '@rebel/api-models/public/emoji/PublicCustomEmojiUpdate'
import { CustomEmojiCreateData, CustomEmojiUpdateData, FullCustomEmoji } from '@rebel/server/services/CustomEmojiService'

export function customEmojiToPublicObject (emoji: FullCustomEmoji): PublicCustomEmoji {
  return {
    id: emoji.id,
    name: emoji.name,
    symbol: emoji.symbol,
    version: emoji.version,
    isActive: emoji.isActive,
    imageUrl: emoji.imageUrl,
    imageWidth: emoji.imageWidth,
    imageHeight: emoji.imageHeight,
    levelRequirement: emoji.levelRequirement,
    canUseInDonationMessage: emoji.canUseInDonationMessage,
    whitelistedRanks: emoji.whitelistedRanks,
    sortOrder: emoji.sortOrder
  }
}

export function publicObjectNewToNewCustomEmoji (emoji: PublicCustomEmojiNew, streamerId: number): CustomEmojiCreateData {
  return {
    name: emoji.name,
    symbol: emoji.symbol,
    streamerId: streamerId,
    imageDataUrl: emoji.imageDataUrl,
    levelRequirement: emoji.levelRequirement,
    canUseInDonationMessage: emoji.canUseInDonationMessage,
    sortOrder: emoji.sortOrder,
    whitelistedRanks: emoji.whitelistedRanks
  }
}

export function publicObjectToCustomEmojiUpdateData (emoji: PublicCustomEmojiUpdate): CustomEmojiUpdateData {
  return {
    id: emoji.id,
    name: emoji.name,
    imageDataUrl: emoji.imageDataUrl,
    levelRequirement: emoji.levelRequirement,
    canUseInDonationMessage: emoji.canUseInDonationMessage,
    whitelistedRanks: emoji.whitelistedRanks
  }
}
