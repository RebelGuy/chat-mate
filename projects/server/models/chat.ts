import { ChatMessage, ChannelInfo, ChatMessagePart, ChatEmoji, ChatText, Channel } from '@prisma/client'
import { YTEmoji } from '@rebel/server/../../masterchat/lib/masterchat'

export type ChatItem = {
  id: string,

  // unix timestamp (in milliseconds)
  timestamp: number,
  author: Author,
  messageParts: PartialChatMessage[],
}

export type PublicChatItem = Omit<ChatItem, 'author'> & {
  internalId: number
  author: PublicAuthor
}

export type Author = {
  name?: string,
  channelId: string,
  image: string,
  attributes: AuthorAttributes
}

export type PublicAuthor = Omit<Author, 'attributes'> & AuthorAttributes & {
  internalId: number
  lastUpdate: number
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

export function privateToPublicItems (chatItems: ChatItemWithRelations[]): PublicChatItem[] {
  return chatItems.map(item => {
    const channelInfo = item.channel.infoHistory[0]
    const result: PublicChatItem = {
      internalId: item.id,
      id: item.youtubeId,
      timestamp: item.time.getTime(),
      author: {
        internalId: item.channel.id,
        channelId: item.channel.youtubeId,
        lastUpdate: channelInfo.time.getTime(),
        name: channelInfo.name,
        image: channelInfo.imageUrl,
        isOwner: channelInfo.isOwner,
        isModerator: channelInfo.isModerator,
        isVerified: channelInfo.IsVerified
      },
      messageParts: item.chatMessageParts.map(part => {
        let partResult: PartialChatMessage
        if (part.text != null && part.emoji == null) {
          const text = part.text!
          partResult = {
            type: 'text',
            text: text.text,
            isBold: text.isBold,
            isItalics: text.isItalics
          }
        } else if (part.text == null && part.emoji != null) {
          const emoji = part.emoji!
          partResult = {
            type: 'emoji',
            emojiId: emoji.youtubeId,
            name: emoji.name!,
            label: emoji.label!,
            image: {
              url: emoji.imageUrl!,
              height: emoji.imageHeight ?? undefined,
              width: emoji.imageWidth ?? undefined
            }
          }
        } else {
          throw new Error('ChatMessagePart must have the text or emoji component defined.')
        }

        return partResult
      })
    }

    return result
  })
}
