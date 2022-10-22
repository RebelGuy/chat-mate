import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group } from '@rebel/server/util/arrays'

export type CustomEmojiWithRankWhitelist = {
  id: number
  isActive: boolean
  modifiedAt: Date
  version: number
  symbol: string
  name: string
  image: Buffer
  levelRequirement: number
  whitelistedRanks: number[]
}

export type CurrentCustomEmoji = CustomEmoji & {
  latestVersion: number
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

/** Note: Updating the symbol is not permitted, as it defines the emoji. */
export type CustomEmojiUpdateData = {
  id: number
  name: string
  image: Buffer
  levelRequirement: number
  whitelistedRanks: number[]
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

  /** Returns the latest versions of active emojis. */
  public async getAllCustomEmojis (): Promise<CustomEmojiWithRankWhitelist[]> {
    const emojiWhitelistsPromise = this.db.customEmojiRankWhitelist.findMany()

    // note: there is a trigger in the `custom_emoji_version` table that gurantees that there is no more than one active version for each emoji
    const emojis = await this.db.customEmojiVersion.findMany({
      where: { isActive: true },
      include: { customEmoji: true }
    })
    const emojiWhitelists = await emojiWhitelistsPromise

    return emojis.map(emoji => ({
      id: emoji.customEmoji.id,
      symbol: emoji.customEmoji.symbol,
      image: emoji.image,
      isActive: emoji.isActive,
      levelRequirement: emoji.levelRequirement,
      modifiedAt: emoji.modifiedAt,
      name: emoji.name,
      version: emoji.version,
      whitelistedRanks: emojiWhitelists.filter(w => w.customEmojiId === emoji.id).map(w => w.rankId)
    } as CustomEmojiWithRankWhitelist))
  }

  /** Returns the created CustomEmoji. */
  public async addCustomEmoji (data: CustomEmojiCreateData): Promise<CustomEmojiWithRankWhitelist> {
    return await this.db.$transaction(async db => {
      const newEmoji = await db.customEmoji.create({ data: { symbol: data.symbol }})

      // we can only do this after the emoji has been created so we have its id
      const newEmojiVersion = await db.customEmojiVersion.create({ data: {
        name: data.name,
        image: data.image,
        levelRequirement: data.levelRequirement,
        isActive: true,
        version: 0,
        customEmojiId: newEmoji.id
      }})

      await db.customEmojiRankWhitelist.createMany({
        data: data.whitelistedRanks.map(r => ({
          customEmojiId: newEmoji.id,
          rankId: r
        }))
      })

      return {
        id: newEmoji.id,
        symbol: newEmoji.symbol,
        isActive: newEmojiVersion.isActive,
        version: newEmojiVersion.version,
        name: newEmojiVersion.name,
        image: newEmojiVersion.image,
        modifiedAt: newEmojiVersion.modifiedAt,
        levelRequirement: newEmojiVersion.levelRequirement,
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
    // there is a BEFORE INSERT trigger in the `custom_emoji_version` table that ensures there is only ever
    // one active version for a given custom emoji. this avoids any potential race conditions when multiple
    // requests are made are the same time

    return await this.db.$transaction(async db => {
      // use updateMany because prisma doesn't know that the search query would only ever result in a single match.
      // unfortnately, this means that we don't get back the updated record, so we have to get that ourselves
      const updateResult = await db.customEmojiVersion.updateMany({
        where: { customEmojiId: data.id, isActive: true },
        data: { isActive: false }
      })

      if (updateResult.count == 0) {
        throw new Error(`Unable to update emoji ${data.id} because it does not exist or has been deactivated`)
      }

      const previousVersion = (await db.customEmojiVersion.findFirst({
        where: { customEmojiId: data.id },
        orderBy: { version: 'desc' }
      }))!

      const updatedEmojiVersion = await db.customEmojiVersion.create({
        data: {
          customEmojiId: data.id,
          name: data.name,
          image: data.image,
          levelRequirement: data.levelRequirement,
          isActive: true,
          version: previousVersion.version + 1
        },
        include: { customEmoji: true }
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
        id: updatedEmojiVersion.customEmoji.id,
        symbol: updatedEmojiVersion.customEmoji.symbol,
        isActive: updatedEmojiVersion.isActive,
        version: updatedEmojiVersion.version,
        name: updatedEmojiVersion.name,
        image: updatedEmojiVersion.image,
        modifiedAt: updatedEmojiVersion.modifiedAt,
        levelRequirement: updatedEmojiVersion.levelRequirement,
        whitelistedRanks: data.whitelistedRanks
      }
    })
  }
}
