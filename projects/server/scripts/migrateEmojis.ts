import { ARGS, DB, NODE_ENV } from '@rebel/server/scripts/consts'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import { Dependencies } from '@rebel/shared/context/context'

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

async function preMigration () {
  const s3 = new S3ProxyService(new Dependencies({
    s3Bucket: process.env.S3_BUCKET!,
    s3Domain: process.env.S3_DOMAIN!,
    s3Key: process.env.S3_KEY!,
    s3Region: process.env.S3_REGION!,
    s3Secret: process.env.S3_SECRET!,
    nodeEnv: NODE_ENV
  }))

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
