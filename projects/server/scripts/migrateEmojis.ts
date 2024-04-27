import { ChatEmoji } from '@prisma/client'
import { ARGS, DB, LOG_SERVICE, NODE_ENV } from '@rebel/server/scripts/consts'
import ImageService from '@rebel/server/services/ImageService'
import S3ProxyService, { S3Image } from '@rebel/server/services/S3ProxyService'
import WebService from '@rebel/server/services/WebService'
import { Dependencies } from '@rebel/shared/context/context'
import { ChatMateError } from '@rebel/shared/util/error'
import sizeOf from 'image-size'

// this script contains two parts:
// 1. *before the migration*, copy all emoji images from MySQL to S3
// 2. *after the migration*, hydrate the image dimension fields in the new image records

// usage: `yarn workspace server migrate-emoji:<local|debug|release> <pre-migration|post-migration>`

const scriptType = ARGS[0]
if (scriptType !== 'pre-migration' && scriptType !== 'post-migration') {
  throw new Error('Script type is the incorrect value: ' + scriptType)
}

type PartialCustomEmoji = {
  customEmojiId: number
  version: number
  streamerId: number
  symbol: string
  image: Buffer
}

type PartialPublicEmoji = {
  id: number
  imageUrl: string
}

const s3 = new S3ProxyService(new Dependencies({
  s3Bucket: process.env.S3_BUCKET!,
  s3Domain: process.env.S3_DOMAIN!,
  s3Key: process.env.S3_KEY!,
  s3Region: process.env.S3_REGION!,
  s3Secret: process.env.S3_SECRET!,
  nodeEnv: NODE_ENV
}))
const imageService = new ImageService(new Dependencies({
  webService: new WebService(),
  logService: LOG_SERVICE
}))

// upload all public and custom emoji images to S3
async function preMigration () {
  const allCustomEmojiVersions = await DB.$queryRawUnsafe<PartialCustomEmoji[]>('SELECT customEmojiId, version, streamerId, symbol, image FROM custom_emoji_version v INNER JOIN custom_emoji e ON customEmojiId = e.id ORDER BY v.id')

  for (const emoji of allCustomEmojiVersions) {
    try {
      const image = emoji.image.toString('base64')
      const fileName = getCustomEmojiFileUrl(emoji)

      await s3.uploadBase64Image(fileName, 'png', false, image)
      console.log(`Uploaded custom emoji ${emoji.symbol} version ${emoji.version} for streamer ${emoji.streamerId}`)
    } catch (e: any) {
      console.error(`Failed to upload custom emoji ${emoji.symbol} version ${emoji.version} for streamer ${emoji.streamerId}: ${e.message}`)
      throw e
    }
  }

  const allPublicEmojis = await DB.$queryRawUnsafe<ChatEmoji[]>('SELECT id, imageUrl FROM chat_emoji ORDER BY id')
  for (const emoji of allPublicEmojis) {
    try {
      const imageData = await imageService.convertToPng(emoji.imageUrl)
      const fileName = getPublicEmojiFileUrl(emoji)

      await s3.uploadBase64Image(fileName, 'png', false, imageData)
      console.log(`Uploaded public emoji ${emoji.id}`)
    } catch (e: any) {
      if (e instanceof ChatMateError) {
        console.error(e.message)
        console.log('Uploading empty image')
      }

      console.error(`Failed to upload public emoji ${emoji.id}: ${e.message}`)
      throw e
    }
  }

  console.log('Done')
}

// fetch all image data from S3 and populate width/height columns
async function postMigration () {
  await DB.$executeRawUnsafe(`
    UPDATE custom_emoji_version v
    LEFT JOIN custom_emoji e ON v.customEmojiId = e.id
    LEFT JOIN image i ON v.imageId = i.id
    SET i.url = concat('${getBaseFolder()}', '/custom-emoji/', e.streamerId, '/', e.id, '/', v.version, '.png')
    WHERE v.id > 0;
  `)
  await DB.$executeRawUnsafe(`
    UPDATE chat_emoji e
    LEFT JOIN image i ON e.imageId = i.id
    SET i.url = concat('${getBaseFolder()}', '/emoji/', e.id, '.png')
    WHERE e.id > 0;
  `)

  const allCustomEmojiVersions = await DB.customEmojiVersion.findMany({ include: { image: true }})
  for (const version of allCustomEmojiVersions) {
    const relativeUrl = version.image.url
    let image: S3Image | null
    try {
      image = await s3.getImage(relativeUrl)
    } catch (e: any) {
      console.error(`Unable to get image for custom emoji version id ${version.id} (image id ${version.image.id}) with relative url ${relativeUrl}: ${e.message}`)
      throw e
    }

    if (image == null) {
      throw new Error(`Image not found for custom emoji version id ${version.id} (image id ${version.image.id})`)
    }

    try {
      const { width, height } = sizeOf(Buffer.from(image.base64Data, 'base64'))

      if (width == null || height == null) {
        throw new Error(`Unknown width/height for custom emoji version id ${version.id} (image id ${version.image.id})`)
      }

      await DB.image.update({
        where: { id: version.image.id },
        data: { width: width, height: height }
      })
      console.log(`Updated custom emoji version id ${version.id} (image id ${version.image.id})`)

    } catch {
      // this can happen if the file is corrupted (hopefully only locally)
      await DB.image.update({
        where: { id: version.image.id },
        data: { width: 16, height: 16 }
      })
      console.error(`Unable to get dimensions for custom emoji version id ${version.id} (image id ${version.image.id})`)
    }
  }

  const allEmojis = await DB.chatEmoji.findMany({ include: { image: true }})
  for (const emoji of allEmojis) {
    const relativeUrl = emoji.image.url
    let image: S3Image | null
    try {
      image = await s3.getImage(relativeUrl)
    } catch (e: any) {
      console.error(`Unable to get image for emoji id ${emoji.id} (image id ${emoji.image.id}) with relative url ${relativeUrl}: ${e.message}`)
      throw e
    }

    if (image == null) {
      throw new Error(`Image not found for emoji id ${emoji.id} (image id ${emoji.image.id})`)
    }

    try {
      const { width, height } = sizeOf(Buffer.from(image.base64Data, 'base64'))

      if (width == null || height == null) {
        throw new Error(`Unknown width/height for emoj id ${emoji.id} (image id ${emoji.image.id})`)
      }

      await DB.image.update({
        where: { id: emoji.image.id },
        data: { width: width, height: height }
      })
      console.log(`Updated emoji id ${emoji.id} (image id ${emoji.image.id})`)

    } catch {
      // unlike custom emojis, this should never happen and is a fatal error
      throw new Error(`Unable to get dimensions for emoji id ${emoji.id} (image id ${emoji.image.id})`)
    }
  }

  console.log('Done')
}

// same as in the CustomEmojiService
function getCustomEmojiFileUrl (emoji: PartialCustomEmoji) {
  return `custom-emoji/${emoji.streamerId}/${emoji.customEmojiId}/${emoji.version}.png`
}

// same as in the EmojiService
function getPublicEmojiFileUrl (emoji: PartialPublicEmoji) {
  return `emoji/${emoji.id}.png`
}

function getBaseFolder () {
  if (NODE_ENV === 'debug') {
    return 'sandbox'
  } else if (NODE_ENV === 'release') {
    return 'prod'
  } else if (NODE_ENV === 'local') {
    return 'local'
  } else {
    throw new Error('Invalid NODE_ENV: ' + NODE_ENV)
  }
}

if (scriptType === 'pre-migration') {
  void preMigration()
} else {
  void postMigration()
}
