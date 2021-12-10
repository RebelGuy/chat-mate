export type ChatItem = {
  internalId: number,
  id: string,

  // unix timestamp (in milliseconds)
  timestamp: number,
  author: Author,
  messageParts: PartialChatMessage[],

  // the message conversion to pure text
  renderedText: string
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

export function getChatText (message: PartialChatMessage[]) {
  return message.map(m => m.type === 'text' ? m.text : `[${m.name}]`).join("")
}
