import { CustomEmoji, CustomEmojiVersion } from '@prisma/client'
import { DB, NODE_ENV } from '@rebel/server/scripts/consts'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import { Dependencies } from '@rebel/shared/context/context'

async function main () {
  const s3 = new S3ProxyService(new Dependencies({
    s3Bucket: process.env.S3_BUCKET!,
    s3Domain: process.env.S3_DOMAIN!,
    s3Key: process.env.S3_KEY!,
    s3Region: process.env.S3_REGION!,
    s3Secret: process.env.S3_SECRET!,
    nodeEnv: NODE_ENV
  }))

  const allVersions = await DB.customEmojiVersion.findMany({ include: { customEmoji: true }})

  for (const version of allVersions) {
    const image = (version as any).image.toString('base64')
    const fileName = getCustomEmojiFileUrl(version)

    await s3.uploadBase64Image(fileName, 'png', false, image)
    console.log(`Uploaded ${version.customEmoji.symbol} version ${version.version} for streamer ${version.customEmoji.streamerId}`)
  }

  console.log('Done')
}

void main()

// same as in the EmojiService
function getCustomEmojiFileUrl (version: CustomEmojiVersion & { customEmoji: CustomEmoji }) {
  return `custom-emoji/${version.customEmoji.streamerId}/${version.customEmoji.id}/${version.version}.png`
}
