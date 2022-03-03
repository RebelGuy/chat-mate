import { ChatMessage, ChannelInfo, ChatMessagePart, ChatEmoji, ChatCustomEmoji, ChatText, Channel, CustomEmoji } from '@prisma/client'
import { YTEmoji } from '@rebel/masterchat'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { PublicMessageCustomEmoji } from '@rebel/server/controllers/public/chat/PublicMessageCustomEmoji'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessagePart } from '@rebel/server/controllers/public/chat/PublicMessagePart'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'
import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { PublicLevelInfo } from '@rebel/server/controllers/public/user/PublicLevelInfo'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { Singular } from '@rebel/server/types'

export type ChatItem = {
  id: string,

  // unix timestamp (in milliseconds)
  timestamp: number,
  author: Author,
  messageParts: PartialChatMessage[],
}

export type Author = {
  name?: string,
  channelId: string,
  image: string,
  attributes: AuthorAttributes
}

export type AuthorAttributes = {
  isOwner: boolean
  isModerator: boolean
  isVerified: boolean
}

export type PartialChatMessage = PartialTextChatMessage | PartialEmojiChatMessage | PartialCustomEmojiChatMessage

export type PartialTextChatMessage = {
  type: 'text',
  text: string,
  isBold: boolean,
  isItalics: boolean
}

export type PartialEmojiChatMessage = {
  type: 'emoji',

  // youtube's ID
  emojiId: string,

  // the hover-over name
  name: string,

  // short emoji label (e.g. shortcut text/search term)
  label: string,
  image: ChatImage
}

export type PartialCustomEmojiChatMessage = {
  type: 'customEmoji'

  text: PartialTextChatMessage
  customEmojiId: number
}

export type ChatImage = {
  url: string,

  // dimensions not set if the image is an SVG
  width?: number,
  height?: number
}

export type ChatItemWithRelations = (ChatMessage & {
  channel: Channel & {
      infoHistory: ChannelInfo[];
  };
  chatMessageParts: (ChatMessagePart & {
      emoji: ChatEmoji | null
      text: ChatText | null
      customEmoji: (ChatCustomEmoji & { text: ChatText, customEmoji: CustomEmoji }) | null
  })[];
})

export function getUniqueEmojiId (emoji: YTEmoji): string {
  if (emoji.image.thumbnails[0].height && emoji.image.thumbnails[0].width && emoji.emojiId.length > 24) {
    // emojis with images already have a unique ids in the form UCkszU2WH9gy1mb0dV-11UJg/xxxxxxxxxxxxxxxxxxxxxx
    return emoji.emojiId
  } else {
    // SVG emojis seem to be those that can be encoding in text directly, and their ID is just the emoji itself.
    // the problem is that, while technically the ids are unique, MySQL seems to have trouble differentiating some of them.
    // so we force the string to be unique by combining it with the label.

    // in rare cases (e.g. 🙌🏻) we only have the accessability data, which is the same as the id. here, we just
    // hope that it can be differentiated by MySQL (another option may be to concatenate the URL, but that might be mutable).
    const label = getEmojiLabel(emoji)
    if (emoji.emojiId === label) {
      return emoji.emojiId
    } else {
      return `${emoji.emojiId}-${getEmojiLabel(emoji)}`
    }
  }
}

// this is unique, and usually of the form :emoji_description:
// it MAY be the emoji symbol itself if no further information is available
export function getEmojiLabel (emoji: YTEmoji): string {
  return emoji.shortcuts?.at(0) ?? emoji.searchTerms?.at(0) ?? emoji.emojiId
}

export function chatAndLevelToPublicChatItem (chat: ChatItemWithRelations, levelData: LevelData): PublicChatItem {
  const messageParts: PublicMessagePart[] = chat.chatMessageParts.map(part => toPublicMessagePart(part))

  const channelInfo = chat.channel.infoHistory[0]
  const userInfo: PublicChannelInfo = {
    schema: 1,
    channelName: channelInfo.name
  }

  const levelInfo: PublicLevelInfo = {
    schema: 1,
    level: levelData.level,
    levelProgress: levelData.levelProgress
  }

  const newItem: PublicChatItem = {
    schema: 1,
    id: chat.id,
    timestamp: chat.time.getTime(),
    messageParts,
    author: {
      schema: 1,
      id: chat.channel.id,
      userInfo,
      levelInfo
    }
  }
  return newItem
}

function toPublicMessagePart (part: Singular<ChatItemWithRelations['chatMessageParts']>): PublicMessagePart {
  let type: 'text' | 'emoji' | 'customEmoji'
  let text: PublicMessageText | null = null
  let emoji: PublicMessageEmoji | null = null
  let customEmoji: PublicMessageCustomEmoji | null = null
  if (part.text != null && part.emoji == null && part.customEmoji == null) {
    type = 'text'
    text = {
      schema: 1,
      text: part.text.text,
      isBold: part.text.isBold,
      isItalics: part.text.isItalics
    }
  } else if (part.emoji != null && part.text == null && part.customEmoji == null) {
    type = 'emoji'
    emoji = {
      schema: 1,
      // so far I am yet to find an instance where either of these are null
      label: part.emoji.label!,
      name: part.emoji.name!,
      image: {
        schema: 1,
        url: part.emoji.imageUrl!,
        height: part.emoji.imageHeight,
        width: part.emoji.imageWidth
      }
    }
  } else if (part.emoji == null && part.text == null && part.customEmoji != null) {
    type = 'customEmoji'
    customEmoji = {
      schema: 1,
      textData: {
        schema: 1,
        text: part.customEmoji.text.text,
        isBold: part.customEmoji.text.isBold,
        isItalics: part.customEmoji.text.isItalics
      },
      customEmoji: {
        schema: 1,
        id: part.customEmoji.id,
        name: part.customEmoji.customEmoji.name,
        symbol: part.customEmoji.customEmoji.symbol,
        levelRequirement: part.customEmoji.customEmoji.levelRequirement,
        imageData: part.customEmoji.customEmoji.image.toString('base64')
      }
    }
  } else {
    throw new Error('ChatMessagePart must have the text, emoji, or customEmoji component defined.')
  }

  const publicPart: PublicMessagePart = {
    schema: 2,
    type,
    textData: text,
    emojiData: emoji,
    customEmojiData: customEmoji
  }
  return publicPart
}

/** Returns the remainder of the text before and after the removal, if any. */
export function removeRangeFromText (part: PartialTextChatMessage, removeStart: number, removeLength: number): [leading: PartialTextChatMessage | null, removed: PartialTextChatMessage, trailing: PartialTextChatMessage | null] {
  if (removeStart < 0 || removeStart >= part.text.length) {
    throw new Error(`Illegal removal index ${removeStart}`)
  } else if (removeLength <= 0 || removeStart + removeLength > part.text.length) {
    throw new Error(`Illegal removeal length ${removeLength}`)
  }

  const leading: PartialTextChatMessage | null = removeStart === 0 ? null : { type: 'text', text: part.text.substring(0, removeStart), isBold: part.isBold, isItalics: part.isItalics }
  const removed: PartialTextChatMessage = { type: 'text', text: part.text.substring(removeStart, removeStart + removeLength), isBold: part.isBold, isItalics: part.isItalics }
  const trailing: PartialTextChatMessage | null = removeStart + removeLength === part.text.length ? null : { type: 'text', text: part.text.substring(removeStart + removeLength, part.text.length), isBold: part.isBold, isItalics: part.isItalics }
  return [leading, removed, trailing]
}
