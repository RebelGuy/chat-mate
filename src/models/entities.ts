import { Prisma } from '@prisma/client'
import { GenericObject, MakeRequired, NullableToOptional } from '@rebel/types'

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


  export type Livestream = Prisma.LivestreamGetPayload<FullSelect<Prisma.LivestreamSelect>>

  export type Channel = Prisma.ChannelGetPayload<FullSelect<Prisma.ChannelSelect>>
  export type ChannelInfo = Prisma.ChannelInfoGetPayload<FullSelect<Prisma.ChannelInfoSelect>>

  // can select specific children whose relations should be fully included!
  // todo: allow typing like ChatMessage<'channel.chatMessages.livestream>
  // todo: automatically add circular references (only need 1 depth for it to work?)
  export type ChatMessage_<C extends keyof Omit<Prisma.ChatMessageInclude, '_count'> = any> = Prisma.ChatMessageGetPayload<FullSelect<Prisma.ChatMessageSelect> & IncludeSpecificChildren<Prisma.ChatMessageInclude, C>>
  export type ChatMessage = Prisma.ChatMessageGetPayload<FullSelect<Prisma.ChatMessageSelect>>
  export type ChatMessagePart = Prisma.ChatMessagePartGetPayload<FullSelect<Prisma.ChatMessagePartSelect>>
  export type ChatEmoji = Prisma.ChatEmojiGetPayload<FullSelect<Prisma.ChatEmojiSelect>>
  export type ChatText = Prisma.ChatTextGetPayload<FullSelect<Prisma.ChatTextSelect>>
 
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
}

// wraps Entity.Object, for creating new entities
// note that `undefined` is interpreted as "not set" (for example in the context of updating a record)
// while `null` is interpreted as the "value null"
export type New<E> = NullableToOptional<Omit<E, 'id'>>
