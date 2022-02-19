import { ChatMessage, ChannelInfo, ChatMessagePart, ChatEmoji, ChatText, Channel } from '@prisma/client'
import { YTEmoji } from '@rebel/masterchat'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessagePart } from '@rebel/server/controllers/public/chat/PublicMessagePart'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'
import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { PublicLevelInfo } from '@rebel/server/controllers/public/user/PublicLevelInfo'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'

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

export type PartialChatMessage = PartialTextChatMessage | PartialEmojiChatMessage

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
      emoji: ChatEmoji | null;
      text: ChatText | null;
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

export function privateToPublicItems (chatItems: ChatItemWithRelations[], levelData: Map<number, LevelData>): PublicChatItem[] {
  let publicChatItems: PublicChatItem[] = []
  for (const chat of chatItems) {
    const messageParts: PublicMessagePart[] = chat.chatMessageParts.map(part => toPublicMessagePart(part))

    const channelInfo = chat.channel.infoHistory[0]
    const userInfo: PublicChannelInfo = {
      schema: 1,
      channelName: channelInfo.name
    }

    const level = levelData.get(chat.channel.id)!
    const levelInfo: PublicLevelInfo = {
      schema: 1,
      level: level.level,
      levelProgress: level.levelProgress
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
    publicChatItems.push(newItem)
  }

  return publicChatItems
}

function toPublicMessagePart (part: ChatMessagePart & { emoji: ChatEmoji | null, text: ChatText | null }): PublicMessagePart {
  let type: 'text' | 'emoji'
  let text: PublicMessageText | null = null
  let emoji: PublicMessageEmoji | null = null
  if (part.text != null && part.emoji == null) {
    type = 'text'
    text = {
      schema: 1,
      text: part.text.text,
      isBold: part.text.isBold,
      isItalics: part.text.isItalics
    }
  } else if (part.emoji != null && part.text == null) {
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
  } else {
    throw new Error('ChatMessagePart must have the text or emoji component defined.')
  }

  const publicPart: PublicMessagePart = {
    schema: 1,
    type,
    textData: text,
    emojiData: emoji
  }
  return publicPart
}
