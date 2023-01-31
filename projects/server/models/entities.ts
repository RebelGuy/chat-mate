import { Prisma } from '@prisma/client'
import { MakeRequired, NullableToOptional } from '@rebel/server/types'

// type extraction based on https://stackoverflow.com/a/69943634
// get the typed model for each table, including its relations.
// the shortcoming here is that the relations do not itself include any relations.
// todo: use nested includes to get everything, or, if not possible, even just one level would be nice
export namespace Entity {
  /*
  // for selecting specific columns
  export type specificChannel = Prisma.ChannelGetPayload<Select<Prisma.ChannelSelect, {
    id: true,
    youtubeId: true,

    chatMessages: true,
    infoHistory: true
  }>>

  type Select<S, T extends MakeRequired<Omit<S, '_count'>>> = { select: T }

  // for selecting all columns within this table
  export type localChannel = Prisma.ChannelGetPayload<true>
  */


  export type Livestream = FullPayload<'Livestream'>

  export type ChatUser = FullPayload<'ChatUser'>
  export type YoutubeChannel = FullPayload<'YoutubeChannel'>
  export type YoutubeChannelInfo = FullPayload<'YoutubeChannelInfo'>
  export type TwitchChannel = FullPayload<'TwitchChannel'>
  export type TwitchChannelInfo = FullPayload<'TwitchChannelInfo'>

  export type ChatMessage = FullPayload<'ChatMessage'>
  export type ChatMessagePart = FullPayload<'ChatMessagePart'>
  export type ChatEmoji = FullPayload<'ChatEmoji'>
  export type ChatText = FullPayload<'ChatText'>
  export type ChatCheer = FullPayload<'ChatCheer'>

  export type ExperienceTransaction = FullPayload<'ExperienceTransaction'>
  export type ExperienceSnapshot = FullPayload<'ExperienceSnapshot'>
  export type ExperienceDataChatMessage = FullPayload<'ExperienceDataChatMessage'>

  export type CustomEmoji = Omit<FullPayload<'CustomEmoji'>, 'chatCustomEmoji' | 'customEmojiRankWhitelist'>
}

// wraps Entity.Object, for creating new entities
// note that `undefined` is interpreted as "not set" (for example in the context of updating a record)
// while `null` is interpreted as the "value null"
export type New<E> = NullableToOptional<Omit<E, 'id'>>

// can select specific children whose relations should be fully included!
// todo: allow typing like WithChildren<'ChatMessage', 'channel.chatMessages.livestream'>
// todo: automatically add circular references (only need 1 depth for it to work?)
export type WithChildren<M extends Models, C extends keyof Omit<Includes[M], '_count'> = any> = GetPayloads<FullSelect<Selects[M]> & IncludeSpecificChildren<Includes[M], C>>[M]

type Models = 'Livestream' |
  'ChatUser' | 'YoutubeChannel' | 'YoutubeChannelInfo' | 'TwitchChannel' | 'TwitchChannelInfo' |
  'ChatMessage' | 'ChatMessagePart' | 'ChatEmoji' | 'ChatText' | 'ChatCheer' |
  'ExperienceTransaction' | 'ExperienceSnapshot' | 'ExperienceDataChatMessage' |
  'CustomEmoji'

type Includes = DbDefine<{
  Livestream: Prisma.LivestreamInclude,
  ChatUser: Prisma.ChatUserInclude,
  YoutubeChannel: Prisma.YoutubeChannelInclude,
  YoutubeChannelInfo: Prisma.YoutubeChannelInfoInclude,
  TwitchChannel: Prisma.TwitchChannelInclude,
  TwitchChannelInfo: Prisma.TwitchChannelInfoInclude,
  ChatMessage: Prisma.ChatMessageInclude,
  ChatMessagePart: Prisma.ChatMessagePartInclude,
  ChatEmoji: Prisma.ChatEmojiInclude,
  ChatText: Prisma.ChatTextInclude,
  ChatCheer: Prisma.ChatCheerInclude,
  ExperienceTransaction: Prisma.ExperienceTransactionInclude,
  ExperienceSnapshot: Prisma.ExperienceSnapshotInclude,
  ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageInclude,
  CustomEmoji: Prisma.CustomEmojiInclude
}>


type GetPayloads<T> = DbDefine<{
  Livestream: Prisma.LivestreamGetPayload<T>,
  ChatUser: Prisma.ChatUserGetPayload<T>,
  YoutubeChannel: Prisma.YoutubeChannelGetPayload<T>,
  YoutubeChannelInfo: Prisma.YoutubeChannelInfoGetPayload<T>,
  TwitchChannel: Prisma.TwitchChannelGetPayload<T>,
  TwitchChannelInfo: Prisma.TwitchChannelInfoGetPayload<T>,
  ChatMessage: Prisma.ChatMessageGetPayload<T>,
  ChatMessagePart: Prisma.ChatMessagePartGetPayload<T>,
  ChatEmoji: Prisma.ChatEmojiGetPayload<T>,
  ChatText: Prisma.ChatTextGetPayload<T>,
  ChatCheer: Prisma.ChatCheerGetPayload<T>,
  ExperienceTransaction: Prisma.ExperienceTransactionGetPayload<T>,
  ExperienceSnapshot: Prisma.ExperienceSnapshotGetPayload<T>,
  ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageGetPayload<T>,
  CustomEmoji: Prisma.CustomEmojiGetPayload<T>
}>

type Selects = DbDefine<{
  Livestream: Prisma.LivestreamSelect,
  ChatUser: Prisma.ChatUserSelect,
  YoutubeChannel: Prisma.YoutubeChannelSelect,
  YoutubeChannelInfo: Prisma.YoutubeChannelInfoSelect,
  TwitchChannel: Prisma.TwitchChannelSelect,
  TwitchChannelInfo: Prisma.TwitchChannelInfoSelect,
  ChatMessage: Prisma.ChatMessageSelect,
  ChatMessagePart: Prisma.ChatMessagePartSelect,
  ChatEmoji: Prisma.ChatEmojiSelect,
  ChatText: Prisma.ChatTextSelect,
  ChatCheer: Prisma.ChatCheerSelect,
  ExperienceTransaction: Prisma.ExperienceTransactionSelect,
  ExperienceSnapshot: Prisma.ExperienceSnapshotSelect,
  ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageSelect,
  CustomEmoji: Prisma.CustomEmojiSelect
}>

type DbDefine<T extends Record<Models, any>> = T

type FullPayload<M extends Models> = GetPayloads<FullSelect<Selects[M]>>[M]

// excludes the _count property
type FullSelect<S> = { select: True<MakeRequired<Omit<S, '_count'>>> }

// gets the model.include.childModel type
type IncludeArgs<I, model extends keyof I> = I[model] extends { include?: infer T } ? T : never

type GetIncludeArgs<I> = ExtractArgs<MakeRequired<I>>

type GetChildIncludes<I, model extends keyof I> = ExtractArgs<Omit<Exclude<IncludeArgs<GetIncludeArgs<I>, model>, null>, '_count'>>

type IncludeChildModel<I, model extends keyof I> = True<GetChildIncludes<I, model>>

// FullSelect automatically adds relations to the children, but here we can additionally add relations to the children of the children.
type IncludeChildren<I> = { include: { [model in keyof Omit<I, '_count'>]-?: { include: IncludeChildModel<I, model> }} }

type IncludeSpecificChildren<I, C extends keyof Omit<I, '_count'>> = { include: { [model in keyof Pick<Omit<I, '_count'>, C>]-?: { include: IncludeChildModel<I, model> }} }


type True<S> = { [K in keyof S]: true }

type ExtractArgs<I> = { [key in keyof I]-?: Exclude<I[key], boolean | undefined> }
