export type ChatItem = {
  internalId: number,
  id: string,
  timestamp: Date,
  author: Author,
  message: PartialChatMessage[]
}

export type Author = {
  internalId: number,
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
  // the emoji id
  text: string,
  image: ChatImage
}

export type ChatImage = {
  url: string,
  width: number,
  height: number
}

export function getChatText (message: PartialChatMessage[]) {
  return message.map(m => m.text).join()
}
