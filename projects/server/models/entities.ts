import { Prisma } from '@prisma/client'
import { MakeRequired, NullableToOptional } from '@rebel/shared/types'

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


  export type YoutubeLivestream = FullPayload<'YoutubeLivestream'>

  export type ChatUser = FullPayload<'ChatUser'>
  export type YoutubeChannel = FullPayload<'YoutubeChannel'>
  export type YoutubeChannelGlobalInfo = FullPayload<'YoutubeChannelGlobalInfo'>
  export type TwitchChannel = FullPayload<'TwitchChannel'>
  export type TwitchChannelGlobalInfo = FullPayload<'TwitchChannelGlobalInfo'>

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

type Models = 'YoutubeLivestream' |
  'ChatUser' | 'YoutubeChannel' | 'YoutubeChannelGlobalInfo' | 'TwitchChannel' | 'TwitchChannelGlobalInfo' |
  'ChatMessage' | 'ChatMessagePart' | 'ChatEmoji' | 'ChatText' | 'ChatCheer' |
  'ExperienceTransaction' | 'ExperienceSnapshot' | 'ExperienceDataChatMessage' |
  'CustomEmoji'

  type Includes = DbDefine<{
    YoutubeLivestream: Prisma.YoutubeLivestreamInclude,
    ChatUser: Prisma.ChatUserInclude,
    YoutubeChannel: Prisma.YoutubeChannelInclude,
    YoutubeChannelGlobalInfo: Prisma.YoutubeChannelGlobalInfoInclude,
    TwitchChannel: Prisma.TwitchChannelInclude,
    TwitchChannelGlobalInfo: Prisma.TwitchChannelGlobalInfoInclude,
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

  type Args = DbDefine<{
    YoutubeLivestream: Prisma.YoutubeLivestreamArgs,
    ChatUser: Prisma.ChatUserArgs,
    YoutubeChannel: Prisma.YoutubeChannelArgs,
    YoutubeChannelGlobalInfo: Prisma.YoutubeChannelGlobalInfoArgs,
    TwitchChannel: Prisma.TwitchChannelArgs,
    TwitchChannelGlobalInfo: Prisma.TwitchChannelGlobalInfoArgs,
    ChatMessage: Prisma.ChatMessageArgs,
    ChatMessagePart: Prisma.ChatMessagePartArgs,
    ChatEmoji: Prisma.ChatEmojiArgs,
    ChatText: Prisma.ChatTextArgs,
    ChatCheer: Prisma.ChatCheerArgs,
    ExperienceTransaction: Prisma.ExperienceTransactionArgs,
    ExperienceSnapshot: Prisma.ExperienceSnapshotArgs,
    ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageArgs,
    CustomEmoji: Prisma.CustomEmojiArgs
  }>

type GetPayloads<T> = DbDefine<{
  YoutubeLivestream: Prisma.YoutubeLivestreamGetPayload<T extends Args['YoutubeLivestream'] ? T : never>,
  ChatUser: Prisma.ChatUserGetPayload<T extends Args['ChatUser'] ? T : never>,
  YoutubeChannel: Prisma.YoutubeChannelGetPayload<T extends Args['YoutubeChannel'] ? T : never>,
  YoutubeChannelGlobalInfo: Prisma.YoutubeChannelGlobalInfoGetPayload<T extends Args['YoutubeChannelGlobalInfo'] ? T : never>,
  TwitchChannel: Prisma.TwitchChannelGetPayload<T extends Args['TwitchChannel'] ? T : never>,
  TwitchChannelGlobalInfo: Prisma.TwitchChannelGlobalInfoGetPayload<T extends Args['TwitchChannelGlobalInfo'] ? T : never>,
  ChatMessage: Prisma.ChatMessageGetPayload<T extends Args['ChatMessage'] ? T : never>,
  ChatMessagePart: Prisma.ChatMessagePartGetPayload<T extends Args['ChatMessagePart'] ? T : never>,
  ChatEmoji: Prisma.ChatEmojiGetPayload<T extends Args['ChatEmoji'] ? T : never>,
  ChatText: Prisma.ChatTextGetPayload<T extends Args['ChatText'] ? T : never>,
  ChatCheer: Prisma.ChatCheerGetPayload<T extends Args['ChatCheer'] ? T : never>,
  ExperienceTransaction: Prisma.ExperienceTransactionGetPayload<T extends Args['ExperienceTransaction'] ? T : never>,
  ExperienceSnapshot: Prisma.ExperienceSnapshotGetPayload<T extends Args['ExperienceSnapshot'] ? T : never>,
  ExperienceDataChatMessage: Prisma.ExperienceDataChatMessageGetPayload<T extends Args['ExperienceDataChatMessage'] ? T : never>,
  CustomEmoji: Prisma.CustomEmojiGetPayload<T extends Args['CustomEmoji'] ? T : never>
}>

type Selects = DbDefine<{
  YoutubeLivestream: Prisma.YoutubeLivestreamSelect,
  ChatUser: Prisma.ChatUserSelect,
  YoutubeChannel: Prisma.YoutubeChannelSelect,
  YoutubeChannelGlobalInfo: Prisma.YoutubeChannelGlobalInfoSelect,
  TwitchChannel: Prisma.TwitchChannelSelect,
  TwitchChannelGlobalInfo: Prisma.TwitchChannelGlobalInfoSelect,
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
