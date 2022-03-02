import { Prisma } from '@prisma/client'
import { EmptyObject, MakeRequired, NullableToOptional } from '@rebel/server/types'

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

  export type Channel = FullPayload<'Channel'>
  export type ChannelInfo = FullPayload<'ChannelInfo'>

  export type ChatMessage = FullPayload<'ChatMessage'>
  export type ChatMessagePart = FullPayload<'ChatMessagePart'>
  export type ChatEmoji = FullPayload<'ChatEmoji'>
  export type ChatText = FullPayload<'ChatText'>

  export type ExperienceTransaction = FullPayload<'ExperienceTransaction'>
  export type ExperienceSnapshot = FullPayload<'ExperienceSnapshot'>
  export type ExperienceDataChatMessage = FullPayload<'ExperienceDataChatMessage'>
  export type ViewingBlock = FullPayload<'ViewingBlock'>

  export type CustomEmoji = Omit<FullPayload<'CustomEmoji'>, 'ChatCustomEmoji'>
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
  'Channel' | 'ChannelInfo' |
  'ChatMessage' | 'ChatMessagePart' | 'ChatEmoji' | 'ChatText' |
  'ExperienceTransaction' | 'ExperienceSnapshot' | 'ExperienceDataChatMessage' | 'ViewingBlock' |
  'CustomEmoji'

type Includes = DbDefine<{
  Livestream: Prisma.LivestreamInclude,
  Channel: Prisma.ChannelInclude,
  ChannelInfo: Prisma.ChannelInfoInclude,
  ChatMessage: Prisma.ChatMessageInclude,
  ChatMessagePart: Prisma.ChatMessagePartInclude,
  ChatEmoji: Prisma.ChatEmojiInclude,
  ChatText: Prisma.ChatTextInclude,
  ExperienceTransaction: Prisma.ExperienceTransactionInclude,
  ExperienceSnapshot: Prisma.ExperienceSnapshotInclude,
  ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageInclude,
  ViewingBlock: Prisma.ViewingBlockInclude,
  CustomEmoji: Prisma.CustomEmojiInclude
}>


type GetPayloads<T> = DbDefine<{
  Livestream: Prisma.LivestreamGetPayload<T>,
  Channel: Prisma.ChannelGetPayload<T>,
  ChannelInfo: Prisma.ChannelInfoGetPayload<T>,
  ChatMessage: Prisma.ChatMessageGetPayload<T>,
  ChatMessagePart: Prisma.ChatMessagePartGetPayload<T>,
  ChatEmoji: Prisma.ChatEmojiGetPayload<T>,
  ChatText: Prisma.ChatTextGetPayload<T>,
  ExperienceTransaction: Prisma.ExperienceTransactionGetPayload<T>,
  ExperienceSnapshot: Prisma.ExperienceSnapshotGetPayload<T>,
  ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageGetPayload<T>,
  ViewingBlock: Prisma.ViewingBlockGetPayload<T>,
  CustomEmoji: Prisma.CustomEmojiGetPayload<T>
}>

type Selects = DbDefine<{
  Livestream: Prisma.LivestreamSelect,
  Channel: Prisma.ChannelSelect,
  ChannelInfo: Prisma.ChannelInfoSelect,
  ChatMessage: Prisma.ChatMessageSelect,
  ChatMessagePart: Prisma.ChatMessagePartSelect,
  ChatEmoji: Prisma.ChatEmojiSelect,
  ChatText: Prisma.ChatTextSelect,
  ExperienceTransaction: Prisma.ExperienceTransactionSelect,
  ExperienceSnapshot: Prisma.ExperienceSnapshotSelect,
  ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageSelect,
  ViewingBlock: Prisma.ViewingBlockSelect,
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