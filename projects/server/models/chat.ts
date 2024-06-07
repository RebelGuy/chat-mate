import { ChatCheer, ChatCommand, ChatCustomEmoji, ChatEmoji, ChatMessage, ChatMessagePart, ChatText, ChatUser, CustomEmojiVersion, Image, RegisteredUser, TwitchChannel, TwitchChannelGlobalInfo, YoutubeChannel, YoutubeChannelGlobalInfo } from '@prisma/client'
import { YTEmoji } from '@rebel/masterchat'
import { PublicChatItem } from '@rebel/api-models/public/chat/PublicChatItem'
import { PublicMessageCheer } from '@rebel/api-models/public/chat/PublicMessageCheer'
import { PublicMessageCustomEmoji } from '@rebel/api-models/public/chat/PublicMessageCustomEmoji'
import { PublicMessageEmoji } from '@rebel/api-models/public/chat/PublicMessageEmoji'
import { PublicMessagePart } from '@rebel/api-models/public/chat/PublicMessagePart'
import { PublicMessageText } from '@rebel/api-models/public/chat/PublicMessageText'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import { PublicLevelInfo } from '@rebel/api-models/public/user/PublicLevelInfo'
import { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import { channelToPublicChannel, registeredUserToPublic } from '@rebel/server/models/user'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import { UserChannel } from '@rebel/server/stores/ChannelStore'
import { Singular } from '@rebel/shared/types'
import { sortBy, sortByLength } from '@rebel/shared/util/arrays'
import { assertUnreachable, assertUnreachableCompile } from '@rebel/shared/util/typescript'
import { ChatMessage as TwitchChatMessage } from '@twurple/chat'
import { SafeExtract } from '@rebel/shared/types'
import { ChatMateError } from '@rebel/shared/util/error'
import { INACCESSIBLE_EMOJI } from '@rebel/server/services/ChatService'
import { buildEmoteImageUrl, parseChatMessage } from '@twurple/chat'

export type ChatPlatform = 'youtube' | 'twitch'

export const PLATFORM_TYPES: ChatPlatform = 'youtube'

export type ChatItem = {
  id: string,

  // unix timestamp (in milliseconds)
  timestamp: number,
  messageParts: PartialChatMessage[],
} & ({
  platform: SafeExtract<ChatPlatform, 'youtube'>
  author: Author
  contextToken: string
} | {
  platform: SafeExtract<ChatPlatform, 'twitch'>
  author: TwitchAuthor
})

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

export type PartialChatMessage = PartialTextChatMessage | PartialEmojiChatMessage | PartialProcessedEmojiChatMessage | PartialCustomEmojiChatMessage | PartialCheerChatMessage
export const PARTIAL_MESSAGE_TYPES: PartialChatMessage['type'] = 'text'

export type PartialTextChatMessage = {
  type: 'text',
  text: string,
  isBold: boolean,
  isItalics: boolean
}

// This is the raw emoji data coming from the platforms
export type PartialEmojiChatMessage = {
  type: 'emoji'

  // the hover-over name
  name: string

  // short emoji label (e.g. shortcut text/search term)
  label: string

  // external url of the emoji, might be an image, svg, or no extension
  url: string

  // dimensions not set if the image is an SVG
  width?: number
  height?: number
}

// This is used **ONLY in place of the `PartialEmojiChatMessage`** when saving a message to the database (ChatStore).
// Before saving a new chat message, we both store any not-before-seen emojis as a new entry, and upload their image to S3.
// What we are left with is the emoji (new or existing) that connects with the relevant emoji part.
export type PartialProcessedEmojiChatMessage = {
  type: 'processedEmoji'

  /** The internal id of the processed emoji. */
  emojiId: number
}

export type PartialCustomEmojiChatMessage = {
  type: 'customEmoji'

  text: PartialTextChatMessage | null
  emoji: PartialEmojiChatMessage | null
  processedEmoji: PartialProcessedEmojiChatMessage | null // for custom emojis that are represented by a public emoji, this should be non-null when saving the chat message
  customEmojiId: number
  customEmojiVersion: number
}

export type PartialCheerChatMessage = {
  type: 'cheer'
  name: string
  amount: number
  /** The image that should be shown */
  imageUrl: string
  /** Hex colour that should be used to show the cheer amount. */
  colour: string
}

export type TwitchAuthor = {
  // todo: make a new user type and user info type
  userId: string
  userName: string
  displayName: string
  userType: 'mod' | 'global_mod' | 'admin' | 'staff' | undefined
  isBroadcaster: boolean
  isSubscriber: boolean
  isMod: boolean
  isVip: boolean

  /** The color (in hex format) the user chose to display in chat. */
  color: string | undefined

  /** Maps the badge category to the detail. */
  badges: Map<string, string>

  /** Maps the badge category to the detail. */
  badgeInfo: Map<string, string>
}

export type ChatEmojiWithImage = ChatEmoji & { image: Image }

/** Evaluates all the getters */
export function evalTwitchPrivateMessage (text: string, msg: TwitchChatMessage): ChatItem {
  const evaluatedParts: PartialChatMessage[] = parseChatMessage(text, msg.emoteOffsets).map(p => {
    if (p.type === 'text') {
      const textPart: PartialTextChatMessage = {
        type: 'text',
        text: p.text,
        isBold: false,
        isItalics: false
      }
      return textPart

    } else if (p.type === 'emote') {
      const emojiPart: PartialEmojiChatMessage = {
        type: 'emoji',
        name: p.name,
        label: p.id, // symbol
        url: buildEmoteImageUrl(p.id, { animationSettings: 'default', backgroundType: 'light', size: '3.0' })
      }
      return emojiPart

    } else if (p.type === 'cheer') {
      const cheerPart: PartialCheerChatMessage = {
        type: 'cheer',
        amount: p.amount,
        name: p.name,
        colour: '',
        imageUrl: ''
      }
      return cheerPart

    } else {
      assertUnreachable(p)
    }
  })

  const evaluatedChatUser: TwitchAuthor = {
    userId: msg.userInfo.userId,
    userName: msg.userInfo.userName,
    displayName: msg.userInfo.displayName,
    userType: msg.userInfo.userType as 'mod' | 'global_mod' | 'admin' | 'staff' | undefined,
    isBroadcaster: msg.userInfo.isBroadcaster,
    isSubscriber: msg.userInfo.isSubscriber,
    isMod: msg.userInfo.isMod,
    isVip: msg.userInfo.isVip,
    color: msg.userInfo.color,
    badges: msg.userInfo.badges,
    badgeInfo: msg.userInfo.badgeInfo
  }

  return {
    id: msg.id,
    timestamp: new Date().getTime(),
    platform: 'twitch',
    author: evaluatedChatUser,
    messageParts: evaluatedParts
  }
}

// wtf
export type ChatItemWithRelations = (ChatMessage & {
  youtubeChannel: YoutubeChannel & { globalInfoHistory: YoutubeChannelGlobalInfo[] } | null
  twitchChannel: TwitchChannel & { globalInfoHistory: TwitchChannelGlobalInfo[] } | null
  chatCommand: ChatCommand | null
  user: (ChatUser & { aggregateChatUser: ChatUser | null }) | null
  chatMessageParts: (ChatMessagePart & {
      emoji: ChatEmojiWithImage | null
      text: ChatText | null
      customEmoji: (ChatCustomEmoji & {
        text: ChatText | null,
        emoji: ChatEmojiWithImage | null,
        customEmojiVersion: CustomEmojiVersion & {
          customEmoji: {
            symbol: string,
            sortOrder: number,
            customEmojiRankWhitelist: { rankId: number }[]
          },
          image: Image
        }
      }) | null
      cheer: ChatCheer | null
  })[]
})

export function convertInternalMessagePartsToExternal (messageParts: ChatItemWithRelations['chatMessageParts']): PartialChatMessage[] {
  const convertText = (text: ChatText): PartialTextChatMessage => ({
    type: 'text',
    text: text.text,
    isBold: text.isBold,
    isItalics: text.isItalics
  })

  // the exact emoji info is not really important here
  const convertEmoji = (emoji: ChatEmojiWithImage): PartialEmojiChatMessage => ({
    type: 'emoji',
    url: emoji.image.url,
    width: emoji.image.width,
    height: emoji.image.height,
    label: emoji.label ?? '',
    name: emoji.name ?? ''
  })

  let result: PartialChatMessage[] = []

  for (const part of messageParts) {
    if (part.text != null) {
      result.push(convertText(part.text))
    } else if (part.emoji != null) {
      result.push(convertEmoji(part.emoji))
    } else if (part.customEmoji != null) {
      result.push({
        type: 'customEmoji',
        customEmojiId: part.customEmoji.id,
        customEmojiVersion: part.customEmoji.customEmojiVersion.id,
        emoji: part.customEmoji.emoji == null ? null : convertEmoji(part.customEmoji.emoji),
        processedEmoji: null,
        text: part.customEmoji.text == null ? null : convertText(part.customEmoji.text)
      })
    } else if (part.cheer != null) {
      result.push({
        type: 'cheer',
        amount: part.cheer.amount,
        colour: part.cheer.colour,
        imageUrl: part.cheer.imageUrl,
        name: part.cheer.name
      })
    } else {
      throw new ChatMateError('Chat message part has an invalid type')
    }
  }

  return result
}

// this is unique, and usually of the form :emoji_description:. if more than one descriptions are available, uses the shortest one.
// it MAY be the emoji symbol itself if no further information is available
function getEmojiLabel (emoji: YTEmoji): string {
  if (emoji.shortcuts != null && emoji.shortcuts.length > 0) {
    // e.g. ['wheelchair', 'wheelchair_symbol']
    return sortByLength(emoji.shortcuts, 'asc')[0]
  } else if (emoji.searchTerms != null && emoji.searchTerms.length > 0) {
    // e.g. ['wheelchair', 'symbol']
    return sortByLength(emoji.searchTerms, 'asc')[0]
  } else if (emoji.image.accessibility?.accessibilityData.label != null) {
    return emoji.image.accessibility.accessibilityData.label
  } else {
    // this could be the unicode representation of the emoji
    return emoji.emojiId
  }
}

// i don't really know how this should be different from the label
function getEmojiName (emoji: YTEmoji): string {
  if (emoji.image.accessibility?.accessibilityData.label != null) {
    return emoji.image.accessibility.accessibilityData.label
  } else if (emoji.searchTerms != null && emoji.searchTerms.length > 0) {
    // e.g. ['wheelchair', 'symbol']
    return sortByLength(emoji.searchTerms, 'asc')[0]
  } else if (emoji.shortcuts != null && emoji.shortcuts.length > 0) {
    // e.g. ['wheelchair', 'wheelchair_symbol']
    return sortByLength(emoji.shortcuts, 'asc')[0]
  } else {
    // this could be the unicode representation of the emoji
    return emoji.emojiId
  }
}

export function ytEmojiToPartialEmojiChatMessage (emoji: YTEmoji): PartialEmojiChatMessage {
  // pick the biggest image
  const image = sortBy(emoji.image.thumbnails, img => (img.height ?? 0) * (img.width ?? 0), 'desc')[0]
  return {
    type: 'emoji',
    name: getEmojiName(emoji),
    label: getEmojiLabel(emoji),
    url: image.url,
    width: image.width,
    height: image.height
  }
}

/** It is expected that all relative URLs are resolved and signed, or marked as inaccessible. */
export function chatAndLevelToPublicChatItem (chat: ChatItemWithRelations, levelData: LevelData, activeRanks: PublicUserRank[], registeredUser: RegisteredUser | null, firstSeen: number): PublicChatItem {
  const messageParts: PublicMessagePart[] = chat.chatMessageParts.map(part => toPublicMessagePart(part))

  if (PLATFORM_TYPES !== 'youtube' && PLATFORM_TYPES !== 'twitch') {
    assertUnreachableCompile(PLATFORM_TYPES)
  }

  if (chat.userId == null || chat.user == null) {
    throw new ChatMateError('ChatItem is expected to have a userId attached')
  }

  let userChannel: UserChannel
  if (chat.youtubeChannel != null) {
    userChannel = {
      aggregateUserId: chat.user.aggregateChatUserId,
      defaultUserId: chat.userId,
      platformInfo: {
        platform: 'youtube',
        channel: chat.youtubeChannel
      }
    }
  } else if (chat.twitchChannel != null) {
    userChannel = {
      aggregateUserId: chat.user.aggregateChatUserId,
      defaultUserId: chat.userId,
      platformInfo: {
        platform: 'twitch',
        channel: chat.twitchChannel
      }
    }
  } else {
    throw new ChatMateError(`Cannot determine platform of chat item ${chat.id} because both the channel and twitchChannel are null`)
  }

  const levelInfo: PublicLevelInfo = {
    level: levelData.level,
    levelProgress: levelData.levelProgress
  }

  const newItem: PublicChatItem = {
    id: chat.id,
    timestamp: chat.time.getTime(),
    platform: userChannel.platformInfo.platform,
    commandId: chat.chatCommand?.id ?? null,
    messageParts,
    author: {
      primaryUserId: getPrimaryUserId(chat.user),
      registeredUser: registeredUserToPublic(registeredUser),
      channel: channelToPublicChannel(userChannel),
      levelInfo,
      activeRanks: activeRanks,
      firstSeen: firstSeen
    }
  }
  return newItem
}

/** It is expected that all relative URLs are resolved and signed, or marked as inaccessible. */
export function toPublicMessagePart (part: Singular<ChatItemWithRelations['chatMessageParts']>): PublicMessagePart {
  if (PARTIAL_MESSAGE_TYPES !== 'text' && PARTIAL_MESSAGE_TYPES !== 'emoji' && PARTIAL_MESSAGE_TYPES !== 'customEmoji' && PARTIAL_MESSAGE_TYPES !== 'cheer' && PARTIAL_MESSAGE_TYPES !== 'processedEmoji') {
    assertUnreachableCompile(PARTIAL_MESSAGE_TYPES)
  }

  let type: 'text' | 'emoji' | 'customEmoji' | 'cheer'
  let text: PublicMessageText | null = null
  let emoji: PublicMessageEmoji | null = null
  let customEmoji: PublicMessageCustomEmoji | null = null
  let cheer: PublicMessageCheer | null = null
  if (part.text != null && part.emoji == null && part.customEmoji == null && part.cheer == null) {
    type = 'text'
    text = {
      text: part.text.text,
      isBold: part.text.isBold,
      isItalics: part.text.isItalics
    }
  } else if (part.emoji != null && part.text == null && part.customEmoji == null && part.cheer == null) {
    type = 'emoji'
    emoji = {
      id: part.emoji.id,
      // so far I am yet to find an instance where either of these are null
      label: part.emoji.label!,
      name: part.emoji.name!,
      image: part.emoji.image.url === INACCESSIBLE_EMOJI ? null : {
        id: part.emoji.image.id,
        url: part.emoji.image.url,
        width: part.emoji.image.width,
        height: part.emoji.image.height
      }
    }
  } else if (part.emoji == null && part.text == null && part.customEmoji != null && part.cheer == null) {
    type = 'customEmoji'
    customEmoji = {
      textData: part.customEmoji.text == null ? null : {
        text: part.customEmoji.text.text,
        isBold: part.customEmoji.text.isBold,
        isItalics: part.customEmoji.text.isItalics
      },
      emojiData: part.customEmoji.emoji == null ? null : {
        id: part.customEmoji.emoji.id,
        label: part.customEmoji.emoji.label!,
        name: part.customEmoji.emoji.name!,
        image: part.customEmoji.emoji.image.url === INACCESSIBLE_EMOJI ? null : {
          id: part.customEmoji.emoji.id,
          url: part.customEmoji.emoji.image.url,
          width: part.customEmoji.emoji.image.width,
          height: part.customEmoji.emoji.image.height
        }
      },
      // this is absolute trash
      customEmoji: {
        id: part.customEmoji.customEmojiVersion.customEmojiId,
        name: part.customEmoji.customEmojiVersion.name,
        symbol: part.customEmoji.customEmojiVersion.customEmoji.symbol,
        levelRequirement: part.customEmoji.customEmojiVersion.levelRequirement,
        canUseInDonationMessage: part.customEmoji.customEmojiVersion.canUseInDonationMessage,
        imageUrl: part.customEmoji.customEmojiVersion.image.url,
        imageWidth: part.customEmoji.customEmojiVersion.image.width,
        imageHeight: part.customEmoji.customEmojiVersion.image.height,
        isActive: part.customEmoji.customEmojiVersion.isActive,
        version: part.customEmoji.customEmojiVersion.version,
        sortOrder: part.customEmoji.customEmojiVersion.customEmoji.sortOrder,
        whitelistedRanks: part.customEmoji.customEmojiVersion.customEmoji.customEmojiRankWhitelist.map(w => w.rankId)
      }
    }
  } else if (part.emoji == null && part.text == null && part.customEmoji == null && part.cheer != null) {
    type = 'cheer'
    cheer = {
      amount: part.cheer.amount,
      colour: part.cheer.colour,
      imageUrl: part.cheer.imageUrl,
      name: part.cheer.name
    }
  } else {
    throw new ChatMateError('ChatMessagePart must have the text, emoji, or customEmoji component defined.')
  }

  const publicPart: PublicMessagePart = {
    type,
    textData: text,
    emojiData: emoji,
    customEmojiData: customEmoji,
    cheerData: cheer
  }
  return publicPart
}

/** Returns the remainder of the text before and after the removal, if any. */
export function removeRangeFromText (part: PartialTextChatMessage, removeStart: number, removeLength: number): [leading: PartialTextChatMessage | null, removed: PartialTextChatMessage, trailing: PartialTextChatMessage | null] {
  if (removeStart < 0 || removeStart >= part.text.length) {
    throw new ChatMateError(`Illegal removal index ${removeStart}`)
  } else if (removeLength <= 0 || removeStart + removeLength > part.text.length) {
    throw new ChatMateError(`Illegal removeal length ${removeLength}`)
  }

  const leading: PartialTextChatMessage | null = removeStart === 0 ? null : { type: 'text', text: part.text.substring(0, removeStart), isBold: part.isBold, isItalics: part.isItalics }
  const removed: PartialTextChatMessage = { type: 'text', text: part.text.substring(removeStart, removeStart + removeLength), isBold: part.isBold, isItalics: part.isItalics }
  const trailing: PartialTextChatMessage | null = removeStart + removeLength === part.text.length ? null : { type: 'text', text: part.text.substring(removeStart + removeLength, part.text.length), isBold: part.isBold, isItalics: part.isItalics }
  return [leading, removed, trailing]
}

export function getExternalId (chatItem: ChatItem) {
  if (chatItem.platform === 'youtube') {
    return chatItem.author.channelId
  } else if (chatItem.platform === 'twitch') {
    return chatItem.author.userId
  } else {
    assertUnreachable(chatItem)
  }
}
