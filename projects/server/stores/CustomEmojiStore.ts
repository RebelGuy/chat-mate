import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group } from '@rebel/shared/util/arrays'
import { ChatMateError, NotFoundError } from '@rebel/shared/util/error'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'

const VERSION_START = 0

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
  chatMateStateService: ChatMateStateService
}>

export default class CustomEmojiStore extends ContextClass {
  private readonly db: Db
  private readonly semaphore: GroupedSemaphore<number>

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.semaphore = deps.resolve('chatMateStateService').getCustomEmojiSemaphore()
  }

  public async getCustomEmojiById (emojiId: number): Promise<CustomEmoji | null> {
    const emoji = await this.db.customEmojiVersion.findFirst({
      where: {
        customEmojiId: emojiId,
        isActive: true
      },
      include: {
        customEmoji: true
      }
    })

    return emoji?.customEmoji ?? null
  }

  /** Returns the latest versions of active emojis. */
  public async getAllCustomEmojis (streamerId: number): Promise<CustomEmojiWithRankWhitelist[]> {
    const emojiWhitelistsPromise = this.db.customEmojiRankWhitelist.findMany()

    // note: there is a trigger in the `custom_emoji_version` table that gurantees that there is no more than one active version for each emoji
    const versions = await this.db.customEmojiVersion.findMany({
      where: { isActive: true, customEmoji: { streamerId} },
      include: { customEmoji: true, image: true }
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
      imageUrl: version.image.url,
      imageWidth: version.image.width,
      imageHeight: version.image.height,
      version: version.version,
      sortOrder: version.customEmoji.sortOrder,
      whitelistedRanks: emojiWhitelists.filter(w => w.customEmojiId === version.customEmoji.id).map(w => w.rankId)
    }))
  }

  /** Since the image URL depends on the emoji that hasn't been created yet, we inject the URL by calling `onGetImageUrl` during the emoji creation process.
   * Returns the created CustomEmoji. */
  public async addCustomEmoji (data: InternalCustomEmojiCreateData, onGetImageInfo: (emojiId: number, version: number) => Promise<ImageInfo>): Promise<CustomEmojiWithRankWhitelist> {
    const newEmoji = await this.db.customEmoji.create({ data: {
      streamerId: data.streamerId,
      symbol: data.symbol,
      sortOrder: data.sortOrder
    }})

    try {
      await this.semaphore.enter(newEmoji.id)

      const emojiFingerprint = getEmojiFingerprint(data.streamerId, newEmoji.id, VERSION_START)
      const imageInfo = await onGetImageInfo(newEmoji.id, VERSION_START)
      const image = await this.db.image.create({ data: {
        fingerprint: emojiFingerprint,
        url: imageInfo.relativeImageUrl,
        width: imageInfo.imageWidth,
        height: imageInfo.imageHeight
      }})

      // we can only do this after the emoji image has been created so we have its id
      const newEmojiVersion = await this.db.customEmojiVersion.create({ data: {
        name: data.name,
        levelRequirement: data.levelRequirement,
        canUseInDonationMessage: data.canUseInDonationMessage,
        isActive: true,
        version: VERSION_START,
        customEmojiId: newEmoji.id,
        imageId: image.id
      }})

      await this.db.customEmojiRankWhitelist.createMany({
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
        imageUrl: image.url,
        imageWidth: image.width,
        imageHeight: image.height,
        modifiedAt: newEmojiVersion.modifiedAt,
        levelRequirement: newEmojiVersion.levelRequirement,
        canUseInDonationMessage: newEmojiVersion.canUseInDonationMessage,
        sortOrder: newEmoji.sortOrder,
        whitelistedRanks: data.whitelistedRanks
      }

    } finally {
      this.semaphore.exit(newEmoji.id)
    }
  }

  public async deactivateCustomEmoji (emojiId: number): Promise<void> {
    await this.db.customEmojiVersion.updateMany({
      where: { customEmojiId: emojiId },
      data: { isActive: false }
    })
  }

  /** Returns the unique rank IDs for which each of the given emojis has been whitelisted, if any.
   * Deactivated emojis are treated as not having any whitelisted ranks. */
  public async getCustomEmojiWhitelistedRanks (emojiIds: number[]): Promise<CustomEmojiWhitelistedRanks[]> {
    const queryResult = await this.db.customEmojiRankWhitelist.findMany({
      where: {
        customEmojiId: { in: emojiIds },
        customEmoji: { customEmojiVersions: { some: { isActive: true }}}
      }
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

  /** Ignores deactivated emojis. */
  public async getEmojiIdFromStreamerSymbol (streamerId: number, symbol: string): Promise<number | null> {
    const emoji = await this.db.customEmoji.findFirst({
      where: {
        streamerId: streamerId,
        symbol: symbol
      }
    })

    return emoji?.id ?? null
  }

  /** Since the image URL depends on the emoji that hasn't been created yet, we inject the URL by calling `onGetImageUrl` during the emoji creation process.
   * Returns the updated CustomEmoji.
   * If `allowDeactivated` is true, a new version of a previously deactivated emoji can be pushed (thereby re-activating the emoji). Otherwise, the request would be rejected. */
  public async updateCustomEmoji (
    data: InternalCustomEmojiUpdateData,
    onGetImageInfo: (streamerId: number, emojiId: number, version: number) => Promise<ImageInfo>,
    allowDeactivated: boolean
  ): Promise<CustomEmojiWithRankWhitelist> {
    // there is a BEFORE INSERT trigger in the `custom_emoji_version` table that ensures there is only ever
    // one active version for a given custom emoji. this avoids any potential race conditions when multiple
    // requests are made at the same time

    try {
      await this.semaphore.enter(data.id)

      // use updateMany because prisma doesn't know that the search query would only ever result in a single match.
      // unfortunately, this means that we don't get back the updated record, so we have to get that ourselves
      const updateResult = await this.db.customEmojiVersion.updateMany({
        where: { customEmojiId: data.id, isActive: allowDeactivated ? undefined : true },
        data: { isActive: false }
      })

      if (updateResult.count === 0) {
        throw new NotFoundError(`Unable to update emoji ${data.id} because it does not exist or has been deactivated`)
      }

      const previousVersion = await this.db.customEmojiVersion.findFirstOrThrow({
        where: { customEmojiId: data.id },
        orderBy: { version: 'desc' },
        include: { customEmoji: true }
      })

      const emojiFingerprint = getEmojiFingerprint(previousVersion.customEmoji.streamerId, previousVersion.customEmoji.id, previousVersion.version + 1)
      const imageInfo = await onGetImageInfo(previousVersion.customEmoji.streamerId, previousVersion.customEmojiId, previousVersion.version + 1)
      const image = await this.db.image.create({ data: {
        fingerprint: emojiFingerprint,
        url: imageInfo.relativeImageUrl,
        width: imageInfo.imageWidth,
        height: imageInfo.imageHeight
      }})

      const updatedEmojiVersion = await this.db.customEmojiVersion.create({
        data: {
          customEmojiId: data.id,
          name: data.name,
          levelRequirement: data.levelRequirement,
          canUseInDonationMessage: data.canUseInDonationMessage,
          isActive: true,
          version: previousVersion.version + 1,
          imageId: image.id
        },
        include: { customEmoji: true }
      })

      await this.db.customEmojiRankWhitelist.deleteMany({
        where: {
          rankId: { notIn: data.whitelistedRanks },
          customEmojiId: data.id
        }
      })
      await this.db.customEmojiRankWhitelist.createMany({
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
        imageUrl: image.url,
        imageWidth: image.width,
        imageHeight: image.height,
        modifiedAt: updatedEmojiVersion.modifiedAt,
        levelRequirement: updatedEmojiVersion.levelRequirement,
        canUseInDonationMessage: updatedEmojiVersion.canUseInDonationMessage,
        sortOrder: updatedEmojiVersion.customEmoji.sortOrder,
        whitelistedRanks: data.whitelistedRanks
      }

    } finally {
      this.semaphore.exit(data.id)
    }
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

function getEmojiFingerprint (streamerId: number, customEmojiId: number, version: number) {
  return `custom-emoji/${streamerId}/${customEmojiId}/${version}`
}
