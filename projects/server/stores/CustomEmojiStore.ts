import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'

export type CustomEmojiWithRankWhitelist = {
  id: number
  isActive: boolean
  modifiedAt: Date
  version: number
  symbol: string
  streamerId: number
  name: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  levelRequirement: number
  canUseInDonationMessage: boolean
  sortOrder: number
  whitelistedRanks: number[]
}

export type CurrentCustomEmoji = CustomEmoji & {
  latestVersion: number
}

export type CustomEmojiWhitelistedRanks = {
  emojiId: number
  rankIds: number[]
}

export type InternalCustomEmojiCreateData = {
  streamerId: number
  symbol: string
  name: string
  levelRequirement: number
  canUseInDonationMessage: boolean
  sortOrder: number
  whitelistedRanks: number[]
}

/** Note: Updating the symbol is not permitted, as it defines the emoji. */
export type InternalCustomEmojiUpdateData = {
  id: number
  name: string
  levelRequirement: number
  canUseInDonationMessage: boolean
  whitelistedRanks: number[]
}

export type ImageInfo = {
  relativeImageUrl: string
  imageWidth: number
  imageHeight: number
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
      isActive: version.isActive,
      levelRequirement: version.levelRequirement,
      canUseInDonationMessage: version.canUseInDonationMessage,
      modifiedAt: version.modifiedAt,
      name: version.name,
      imageUrl: version.imageUrl,
      imageWidth: version.imageWidth,
      imageHeight: version.imageHeight,
      version: version.version,
      sortOrder: version.customEmoji.sortOrder,
      whitelistedRanks: emojiWhitelists.filter(w => w.customEmojiId === version.customEmoji.id).map(w => w.rankId)
    }))
  }

  /** Since the image URL depends on the emoji that hasn't been created yet, we inject the URL by calling `onGetImageUrl` during the emoji creation process.
   * Returns the created CustomEmoji. */
  public async addCustomEmoji (data: InternalCustomEmojiCreateData, onGetImageInfo: (emojiId: number, version: number) => Promise<ImageInfo>): Promise<CustomEmojiWithRankWhitelist> {
    return await this.db.$transaction(async db => {
      const newEmoji = await db.customEmoji.create({ data: {
        streamerId: data.streamerId,
        symbol: data.symbol,
        sortOrder: data.sortOrder
      }})

      // we can only do this after the emoji has been created so we have its id
      const tempNewEmojiVersion = await db.customEmojiVersion.create({ data: {
        name: data.name,
        imageUrl: '',
        imageWidth: 1,
        imageHeight: 1,
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

      const imageInfo = await onGetImageInfo(newEmoji.id, tempNewEmojiVersion.version)
      const newEmojiVersion = await db.customEmojiVersion.update({
        where: { id: tempNewEmojiVersion.id },
        data: {
          imageUrl: imageInfo.relativeImageUrl,
          imageWidth: imageInfo.imageWidth,
          imageHeight: imageInfo.imageHeight
        }
      })

      return {
        id: newEmoji.id,
        symbol: newEmoji.symbol,
        streamerId: newEmoji.streamerId,
        isActive: newEmojiVersion.isActive,
        version: newEmojiVersion.version,
        name: newEmojiVersion.name,
        imageUrl: newEmojiVersion.imageUrl,
        imageWidth: newEmojiVersion.imageWidth,
        imageHeight: newEmojiVersion.imageHeight,
        modifiedAt: newEmojiVersion.modifiedAt,
        levelRequirement: newEmojiVersion.levelRequirement,
        canUseInDonationMessage: newEmojiVersion.canUseInDonationMessage,
        sortOrder: newEmoji.sortOrder,
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

  /** Since the image URL depends on the emoji that hasn't been created yet, we inject the URL by calling `onGetImageUrl` during the emoji creation process.
   * Returns the updated CustomEmoji. */
  public async updateCustomEmoji (data: InternalCustomEmojiUpdateData, onGetImageInfo: (streamerId: number, emojiId: number, version: number) => Promise<ImageInfo>): Promise<CustomEmojiWithRankWhitelist> {
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
        throw new ChatMateError(`Unable to update emoji ${data.id} because it does not exist or has been deactivated`)
      }

      const previousVersion = (await db.customEmojiVersion.findFirst({
        where: { customEmojiId: data.id },
        orderBy: { version: 'desc' }
      }))!

      const tempUpdatedEmojiVersion = await db.customEmojiVersion.create({
        data: {
          customEmojiId: data.id,
          name: data.name,
          imageUrl: '',
          imageWidth: 1,
          imageHeight: 1,
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

      // we could optimise this a little by getting the URL before creating the new version (since we know in advance what the version will be),
      // but that runs the risk that the new version will fail to create due to a race condition with the creation of another version.
      // it is safest to wait as long as possible before uploading the image.
      const imageInfo = await onGetImageInfo(tempUpdatedEmojiVersion.customEmoji.streamerId, tempUpdatedEmojiVersion.customEmojiId, tempUpdatedEmojiVersion.version)
      const updatedEmojiVersion = await db.customEmojiVersion.update({
        where: { id: tempUpdatedEmojiVersion.id },
        data: {
          imageUrl: imageInfo.relativeImageUrl,
          imageWidth: imageInfo.imageWidth,
          imageHeight: imageInfo.imageHeight
        },
        include: { customEmoji: true }
      })

      return {
        id: updatedEmojiVersion.customEmoji.id,
        symbol: updatedEmojiVersion.customEmoji.symbol,
        streamerId: updatedEmojiVersion.customEmoji.streamerId,
        isActive: updatedEmojiVersion.isActive,
        version: updatedEmojiVersion.version,
        name: updatedEmojiVersion.name,
        imageUrl: updatedEmojiVersion.imageUrl,
        imageWidth: updatedEmojiVersion.imageWidth,
        imageHeight: updatedEmojiVersion.imageHeight,
        modifiedAt: updatedEmojiVersion.modifiedAt,
        levelRequirement: updatedEmojiVersion.levelRequirement,
        canUseInDonationMessage: updatedEmojiVersion.canUseInDonationMessage,
        sortOrder: updatedEmojiVersion.customEmoji.sortOrder,
        whitelistedRanks: data.whitelistedRanks
      }
    })
  }

  public async updateCustomEmojiSortOrders (ids: number[], sortOrders: number[]) {
    if ([...ids, ...sortOrders].some(x => typeof x !== 'number' || isNaN(x))) {
      throw new ChatMateError('Invalid input')
    }

    await this.db.$executeRawUnsafe(`
      UPDATE custom_emoji
      SET sortOrder =
        CASE id
          ${ids.map((id, i) => `WHEN ${id} THEN ${sortOrders[i]}`).join(' ')}
        END
      WHERE id IN (${ids.join(', ')})
    `)
  }
}
