import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group } from '@rebel/server/util/arrays'

export type CustomEmojiWithRankWhitelist = CustomEmoji & {
  whitelistedRanks: number[]
}

export type CustomEmojiWhitelistedRanks = {
  emojiId: number
  rankIds: number[]
}

export type CustomEmojiCreateData = {
  symbol: string
  name: string
  image: Buffer
  levelRequirement: number
  whitelistedRanks: number[]
}

export type CustomEmojiUpdateData = CustomEmojiCreateData & {
  id: number
}

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class CustomEmojiStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  public async getAllCustomEmojis (): Promise<CustomEmojiWithRankWhitelist[]> {
    const emojiWhitelistsPromise = this.db.customEmojiRankWhitelist.findMany()
    const emojis = await this.db.customEmoji.findMany()
    const emojiWhitelists = await emojiWhitelistsPromise

    return emojis.map(emoji => ({
      ...emoji,
      whitelistedRanks: emojiWhitelists.filter(w => w.customEmojiId === emoji.id).map(w => w.rankId)
    }))
  }

  /** Returns the created CustomEmoji. */
  public async addCustomEmoji (data: CustomEmojiCreateData): Promise<CustomEmojiWithRankWhitelist> {
    return await this.db.$transaction(async db => {
      const newEmoji = await db.customEmoji.create({ data: {
        name: data.name,
        symbol: data.symbol,
        image: data.image,
        levelRequirement: data.levelRequirement
      }})

      // we can only do this after the emoji has been created so we have its id
      await db.customEmojiRankWhitelist.createMany({
        data: data.whitelistedRanks.map(r => ({
          customEmojiId: newEmoji.id,
          rankId: r
        }))
      })

      return {
        ...newEmoji,
        whitelistedRanks: data.whitelistedRanks
      }
    })
  }

  /** Returns the unique rank IDs for which each of the given emojis has been whitelisted, if any. */
  public async getCustomEmojiWhitelistedRanks (emojiIds: number[]): Promise<CustomEmojiWhitelistedRanks[]> {
    const queryResult = await this.db.customEmojiRankWhitelist.findMany({
      where: { customEmojiId: { in: emojiIds } }
    })

    const grouped = group(queryResult, w => w.customEmojiId)

    // keep the original order of ids
    return emojiIds.map(id => {
      const whitelistGroup = grouped.find(g => g.group === id)
      if (whitelistGroup == null) {
        return {
          emojiId: id,
          rankIds: []
        }
      } else {
        return {
          emojiId: id,
          rankIds: whitelistGroup.items.map(w => w.rankId)
        }
      }
    })
  }

  /** Returns the updated CustomEmoji. */
  public async updateCustomEmoji (data: CustomEmojiUpdateData): Promise<CustomEmojiWithRankWhitelist> {
    return await this.db.$transaction(async db => {
      const updatedEmoji = await db.customEmoji.update({
        where: { id: data.id },
        data: {
          name: data.name,
          symbol: data.symbol,
          image: data.image,
          levelRequirement: data.levelRequirement
        }
      })

      await db.customEmojiRankWhitelist.deleteMany({
        where: {
          rankId: { notIn: data.whitelistedRanks },
          customEmojiId: data.id
        }
      })
      await db.customEmojiRankWhitelist.createMany({
        data: data.whitelistedRanks.map(r => ({ customEmojiId: data.id, rankId: r })),
        skipDuplicates: true
      })

      return {
        ...updatedEmoji,
        whitelistedRanks: data.whitelistedRanks
      }
    })
  }
}
