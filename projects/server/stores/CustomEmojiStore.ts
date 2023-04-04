import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group } from '@rebel/shared/util/arrays'

export type CustomEmojiWithRankWhitelist = {
  id: number
  isActive: boolean
  modifiedAt: Date
  version: number
  symbol: string
  streamerId: number
  name: string
  image: Buffer
  levelRequirement: number
  canUseInDonationMessage: boolean
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
  streamerId: number
  symbol: string
  name: string
  image: Buffer
  levelRequirement: number
  canUseInDonationMessage: boolean
  whitelistedRanks: number[]
}

/** Note: Updating the symbol is not permitted, as it defines the emoji. */
export type CustomEmojiUpdateData = {
  id: number
  name: string
  image: Buffer
  levelRequirement: number
  canUseInDonationMessage: boolean
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
  public async getAllCustomEmojis (streamerId: number): Promise<CustomEmojiWithRankWhitelist[]> {
    const emojiWhitelistsPromise = this.db.customEmojiRankWhitelist.findMany()

    // note: there is a trigger in the `custom_emoji_version` table that gurantees that there is no more than one active version for each emoji
    const versions = await this.db.customEmojiVersion.findMany({
      where: { isActive: true, customEmoji: { streamerId} },
      include: { customEmoji: true }
    })
    const emojiWhitelists = await emojiWhitelistsPromise

    return versions.map(version => ({
      id: version.customEmoji.id,
      symbol: version.customEmoji.symbol,
      streamerId: version.customEmoji.streamerId,
      image: version.image,
      isActive: version.isActive,
      levelRequirement: version.levelRequirement,
      canUseInDonationMessage: version.canUseInDonationMessage,
      modifiedAt: version.modifiedAt,
      name: version.name,
      version: version.version,
      whitelistedRanks: emojiWhitelists.filter(w => w.customEmojiId === version.customEmoji.id).map(w => w.rankId)
    }))
  }

  /** Returns the created CustomEmoji. */
  public async addCustomEmoji (data: CustomEmojiCreateData): Promise<CustomEmojiWithRankWhitelist> {
    return await this.db.$transaction(async db => {
      const newEmoji = await db.customEmoji.create({ data: {
        streamerId: data.streamerId,
        symbol: data.symbol
      }})

      // we can only do this after the emoji has been created so we have its id
      const newEmojiVersion = await db.customEmojiVersion.create({ data: {
        name: data.name,
        image: data.image,
        levelRequirement: data.levelRequirement,
        canUseInDonationMessage: data.canUseInDonationMessage,
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
        streamerId: newEmoji.streamerId,
        isActive: newEmojiVersion.isActive,
        version: newEmojiVersion.version,
        name: newEmojiVersion.name,
        image: newEmojiVersion.image,
        modifiedAt: newEmojiVersion.modifiedAt,
        levelRequirement: newEmojiVersion.levelRequirement,
        canUseInDonationMessage: newEmojiVersion.canUseInDonationMessage,
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
    // requests are made at the same time

    return await this.db.$transaction(async db => {
      // use updateMany because prisma doesn't know that the search query would only ever result in a single match.
      // unfortunately, this means that we don't get back the updated record, so we have to get that ourselves
      const updateResult = await db.customEmojiVersion.updateMany({
        where: { customEmojiId: data.id, isActive: true },
        data: { isActive: false }
      })

      if (updateResult.count === 0) {
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
          canUseInDonationMessage: data.canUseInDonationMessage,
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
        streamerId: updatedEmojiVersion.customEmoji.streamerId,
        isActive: updatedEmojiVersion.isActive,
        version: updatedEmojiVersion.version,
        name: updatedEmojiVersion.name,
        image: updatedEmojiVersion.image,
        modifiedAt: updatedEmojiVersion.modifiedAt,
        levelRequirement: updatedEmojiVersion.levelRequirement,
        canUseInDonationMessage: updatedEmojiVersion.canUseInDonationMessage,
        whitelistedRanks: data.whitelistedRanks
      }
    })
  }
}
