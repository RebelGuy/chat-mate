import { ARGS, DB, NODE_ENV } from '@rebel/server/scripts/consts'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import { Dependencies } from '@rebel/shared/context/context'
import sizeOf from 'image-size'

// this script contains two parts:
// 1. *before the migration*, copy all emoji images from MySQL to S3
// 2. *after the migration*, hydrate the new imageUrl fields

// usage: `yarn workspace server migrate-emoji:<local|debug|release> <pre-migration|post-migration>`

const scriptType = ARGS[0]
if (scriptType !== 'pre-migration' && scriptType !== 'post-migration') {
  throw new Error('Script type is the incorrect value: ' + scriptType)
}

type PartialEmoji = {
  customEmojiId: number
  version: number
  streamerId: number
  symbol: string
  image: Buffer
}

const s3 = new S3ProxyService(new Dependencies({
  s3Bucket: process.env.S3_BUCKET!,
  s3Domain: process.env.S3_DOMAIN!,
  s3Key: process.env.S3_KEY!,
  s3Region: process.env.S3_REGION!,
  s3Secret: process.env.S3_SECRET!,
  nodeEnv: NODE_ENV
}))

async function preMigration () {
  const allVersions = await DB.$queryRawUnsafe<PartialEmoji[]>('SELECT customEmojiId, version, streamerId, symbol, image FROM custom_emoji_version INNER JOIN custom_emoji e ON customEmojiId = e.id')//.customEmojiVersion.findMany({ include: { customEmoji: true }})

  for (const emoji of allVersions) {
    const image = emoji.image.toString('base64')
    const fileName = getCustomEmojiFileUrl(emoji)

    await s3.uploadBase64Image(fileName, 'png', false, image)
    console.log(`Uploaded ${emoji.symbol} version ${emoji.version} for streamer ${emoji.streamerId}`)
  }

  console.log('Done')
}

async function postMigration () {
  await DB.$executeRawUnsafe(`
    UPDATE custom_emoji_version v
    LEFT JOIN custom_emoji e ON v.customEmojiId = e.id
    SET imageUrl = concat('${getBaseFolder()}', '/custom-emoji/', e.streamerId, '/', e.id, '/', v.version, '.png')
    WHERE v.id > 0;
  `)

  const allEmojiVersions = await DB.customEmojiVersion.findMany()
  for (const version of allEmojiVersions) {
    const relativeUrl = version.imageUrl
    const image = await s3.getImage(relativeUrl)

    if (image == null) {
      throw new Error(`Image not found for emoji version id ${version.id}`)
    }

    try {
      const { width, height } = sizeOf(Buffer.from(image.base64Data, 'base64'))

      if (width == null || height == null) {
        throw new Error(`Unknown width/height for emoji version id ${version.id}`)
      } else {
        console.log(`Updated emoji version id ${version.id}`)
      }

      await DB.customEmojiVersion.update({
        where: { id: version.id },
        data: { imageWidth: width, imageHeight: height }
      })
      console.log(`Updated emoji version id ${version.id}`)

    } catch {
      // this can happen if the file is corrupted (hopefully only locally)
      await DB.customEmojiVersion.update({
        where: { id: version.id },
        data: { imageWidth: 16, imageHeight: 16 }
      })
      console.error(`Unable to get dimensions for version id ${version.id}`)
    }
  }

  console.log('Done')
}

// same as in the EmojiService
function getCustomEmojiFileUrl (emoji: PartialEmoji) {
  return `custom-emoji/${emoji.streamerId}/${emoji.customEmojiId}/${emoji.version}.png`
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
