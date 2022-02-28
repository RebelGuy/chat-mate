import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { Entity, New } from '@rebel/server/models/entities'

export function customEmojiToPublicObject (emoji: Entity.CustomEmoji): PublicCustomEmoji {
  return {
    schema: 1,
    id: emoji.id,
    name: emoji.name,
    symbol: emoji.symbol,
    imageData: emoji.image.toString('utf8'),
    levelRequirement: emoji.levelRequirement
  }
}

export function publicObjectNewToNewCustomEmoji (emoji: PublicCustomEmojiNew): New<Entity.CustomEmoji> {
  return {
    name: emoji.name,
    symbol: emoji.symbol,
    image: Buffer.from(emoji.imageData, 'utf8'),
    levelRequirement: emoji.levelRequirement
  }
}

export function publicObjectToCustomEmoji (emoji: PublicCustomEmoji): Entity.CustomEmoji {
  return {
    id: emoji.id,
    name: emoji.name,
    symbol: emoji.symbol,
    image: Buffer.from(emoji.imageData, 'utf8'),
    levelRequirement: emoji.levelRequirement
  }
}
