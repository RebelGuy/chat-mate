import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group } from '@rebel/shared/util/arrays'
import { ChatMateError, NotFoundError } from '@rebel/shared/util/error'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import { ImageInfo } from '@rebel/server/services/ImageService'
import { SafeOmit } from '@rebel/shared/types'

const VERSION_START = 0

export type CustomEmojiWithRankWhitelist = {
  id: number
  deletedAt: number | null
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

export type CurrentCustomEmoji = SafeOmit<CustomEmoji, 'deletedAt'> & {
  latestVersion: number
  deletedAt: number | null
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

type QueriedCustomEmoji = {
  id: number
  symbol: string
  streamerId: number
  deletedAt: Date | null
  levelRequirement: number
  canUseInDonationMessage: boolean
  modifiedAt: Date
  name: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  version: number
  sortOrder: number
  emojiVersionId: number
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
        customEmoji: { deletedAt: null }
      },
      orderBy: { modifiedAt: 'desc' },
      include: {
        customEmoji: true
      }
    })

    return emoji?.customEmoji ?? null
  }

  /** Returns the latest versions of active emojis. */
  public async getAllCustomEmojis (streamerId: number): Promise<CustomEmojiWithRankWhitelist[]> {
    const emojiWhitelistsPromise = this.db.customEmojiRankWhitelist.findMany({
      where: { customEmojiVersion: { customEmoji: { streamerId }}}
    })

    const emojis = await this.db.$queryRaw<QueriedCustomEmoji[]>`
      SELECT
        e.id AS id,
        e.symbol AS symbol,
        e.streamerId AS streamerId,
        e.deletedAt AS deletedAt,
        ev.levelRequirement AS levelRequirement,
        ev.canUseInDonationMessage AS canUseInDonationMessage,
        ev.modifiedAt AS modifiedAt,
        ev.name AS name,
        i.url AS imageUrl,
        i.width AS imageWidth,
        i.height AS imageHeight,
        ev.version AS version,
        e.sortOrder AS sortOrder,
        ev.id AS emojiVersionId
      FROM custom_emoji e
      JOIN custom_emoji_version ev ON e.id = ev.customEmojiId
      JOIN image i ON ev.imageId = i.id

      -- attach only the latest custom_emoji_version record
      WHERE ev.id = (
        SELECT id
        FROM custom_emoji_version
        WHERE customEmojiId = e.id
        ORDER BY modifiedAt DESC
        LIMIT 1
      ) AND e.streamerId = ${streamerId} AND e.deletedAt IS NULL;
    `
    const emojiWhitelists = await emojiWhitelistsPromise

    return emojis.map(emoji => ({
      id: emoji.id,
      symbol: emoji.symbol,
      streamerId: emoji.streamerId,
      deletedAt: emoji.deletedAt?.getTime() ?? null,
      levelRequirement: emoji.levelRequirement,
      canUseInDonationMessage: emoji.canUseInDonationMessage,
      modifiedAt: emoji.modifiedAt,
      name: emoji.name,
      imageUrl: emoji.imageUrl,
      imageWidth: emoji.imageWidth,
      imageHeight: emoji.imageHeight,
      version: emoji.version,
      sortOrder: emoji.sortOrder,
      whitelistedRanks: emojiWhitelists.filter(w => w.customEmojiVersionId === emoji.emojiVersionId).map(w => w.rankId)
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
        version: VERSION_START,
        customEmojiId: newEmoji.id,
        imageId: image.id
      }})

      await this.db.customEmojiRankWhitelist.createMany({
        data: data.whitelistedRanks.map(r => ({
          customEmojiVersionId: newEmojiVersion.id,
          rankId: r,
        }))
      })

      return {
        id: newEmoji.id,
        symbol: newEmoji.symbol,
        streamerId: newEmoji.streamerId,
        deletedAt: null,
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
    await this.db.customEmoji.update({
      where: { id: emojiId },
      data: { deletedAt: new Date() }
    })
  }

  /** Returns the unique rank IDs for which each of the given emojis has been whitelisted, if any.
   * Deleted emojis are treated as not having any whitelisted ranks. */
  public async getCustomEmojiWhitelistedRanks (emojiIds: number[]): Promise<CustomEmojiWhitelistedRanks[]> {
    const queryResult = await this.db.customEmojiRankWhitelist.findMany({
      where: {
        customEmojiVersion: {
          customEmoji: {
            id: { in: emojiIds },
            deletedAt: null
          }
        }
      },
      select: {
        rankId: true,
        customEmojiVersion: { select: { customEmojiId: true } }
      }
    })

    const grouped = group(queryResult, w => w.customEmojiVersion.customEmojiId)

    // keep the original order of ids
    return emojiIds.map(id => {
      const whitelistGroup = grouped.find(g => g.group === id)
      if (whitelistGroup == null) {
        // deleted
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
    try {
      await this.semaphore.enter(data.id)

      // use updateMany because prisma doesn't know that the search query would only ever result in a single match.
      // unfortunately, this means that we don't get back the updated record, so we have to get that ourselves
      const previousVersion = await this.db.customEmojiVersion.findFirst({
        where: {
          customEmojiId: data.id,
          customEmoji: { deletedAt: allowDeactivated ? undefined : null }
        },
        orderBy: { version: 'desc' },
        include: { customEmoji: true }
      })

      if (previousVersion == null) {
        throw new NotFoundError(`Unable to update emoji ${data.id} because it does not exist or has been deleted`)
      }

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
          version: previousVersion.version + 1,
          imageId: image.id
        },
        include: { customEmoji: true }
      })

      // undelete the emoji if required
      if (previousVersion.customEmoji.deletedAt != null) {
        await this.db.customEmoji.update({
          where: { id: data.id },
          data: { deletedAt: null }
        })
      }

      await this.db.customEmojiRankWhitelist.createMany({
        data: data.whitelistedRanks.map(r => ({ customEmojiVersionId: updatedEmojiVersion.id, rankId: r })),
        skipDuplicates: true
      })

      return {
        id: updatedEmojiVersion.customEmoji.id,
        symbol: updatedEmojiVersion.customEmoji.symbol,
        streamerId: updatedEmojiVersion.customEmoji.streamerId,
        deletedAt: null,
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
