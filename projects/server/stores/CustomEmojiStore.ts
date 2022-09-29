import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { Entity, New } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group, groupedSingle, zip } from '@rebel/server/util/arrays'

export type EmojiRankWhitelist = {
  emojiId: number
  rankIds: number[]
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

  public async getAllCustomEmojis (): Promise<Entity.CustomEmoji[]> {
    return await this.db.customEmoji.findMany()
  }

  /** Returns the created CustomEmoji. */
  public async addCustomEmoji (data: New<Entity.CustomEmoji>): Promise<Entity.CustomEmoji> {
    return await this.db.customEmoji.create({ data: {
      name: data.name,
      symbol: data.symbol,
      image: data.image,
      levelRequirement: data.levelRequirement
    }})
  }

  /** Returns the unique rank IDs for which each of the given emojis has been whitelisted, if any. */
  public async getCustomEmojiWhitelistedRanks (emojiIds: number[]): Promise<EmojiRankWhitelist[]> {
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
  public async updateCustomEmoji (data: Entity.CustomEmoji): Promise<Entity.CustomEmoji> {
    return await this.db.customEmoji.update({
      where: { id: data.id },
      data: {
        name: data.name,
        symbol: data.symbol,
        image: data.image,
        levelRequirement: data.levelRequirement
      }
    })
  }
}
