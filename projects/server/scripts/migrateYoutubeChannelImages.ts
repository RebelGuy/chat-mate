import S3ClientProvider from '@rebel/server/providers/S3ClientProvider'
import { DB, LOG_SERVICE, NODE_ENV } from '@rebel/server/scripts/consts'
import ImageService, { QUESTION_MARK_BASE64 } from '@rebel/server/services/ImageService'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import WebService from '@rebel/server/services/WebService'
import { Dependencies } from '@rebel/shared/context/context'
import sizeOf from 'image-size'

// this script must be run after the migration. it downloads images from youtube and, where available, attaches them to the global info records.

// usage: `yarn workspace server migrate-youtube-channel-images:<local|debug|release>`

const s3 = new S3ProxyService(new Dependencies({
  s3Bucket: process.env.S3_BUCKET!,
  s3Domain: process.env.S3_DOMAIN!,
  nodeEnv: NODE_ENV,
  s3ClientProvider: new S3ClientProvider(new Dependencies({
    s3Bucket: process.env.S3_BUCKET!,
    s3Domain: process.env.S3_DOMAIN!,
    s3Key: process.env.S3_KEY!,
    s3Region: process.env.S3_REGION!,
    s3Secret: process.env.S3_SECRET!
  }))
}))
const imageService = new ImageService(new Dependencies({
  webService: new WebService(),
  logService: LOG_SERVICE
}))

async function main () {
  await DB.$executeRawUnsafe(`
    UPDATE youtube_channel_global_info c
    LEFT JOIN image i ON c.imageId = i.id
    SET i.url = concat('${getBaseFolder()}', '/channel/youtube/', c.channelId, '/', c.id, '.png')
    WHERE c.id > 0;
  `)

  const channelInfos = await DB.youtubeChannelGlobalInfo.findMany({ include: { image: true }})
  for (const channelInfo of channelInfos) {
    if (channelInfo.image.width > 0) {
      console.log(`Skipping image for channel id ${channelInfo.channelId} (info id ${channelInfo.id}) as it is already done...`)
      continue
    }

    try {
      const originalUrl = channelInfo.image.originalUrl!
      const scaledUrl = upsizeYoutubeImage(originalUrl)
      let image = QUESTION_MARK_BASE64
      try {
        image = await imageService.convertToPng(scaledUrl, 'null') ?? await imageService.convertToPng(originalUrl, 'questionMark')
      } catch (e: any) {
        console.error(`  -  Failed to fetch image for channel id ${channelInfo.channelId} (info id ${channelInfo.id}), setting to question mark image. Error:`, e.message)
      }

      const fileName = getChannelImageUrl(channelInfo.channelId, channelInfo.id)

      await s3.uploadBase64Image(fileName, 'png', false, image)

      const { width, height } = sizeOf(Buffer.from(image, 'base64'))
      await DB.image.update({
        where: { id: channelInfo.imageId },
        data: {
          url: `${getBaseFolder()}/${fileName}`,
          width: width,
          height: height
        }
      })

      console.log(`Processed image for channel id ${channelInfo.channelId} (info id ${channelInfo.id})`)
    } catch (e: any) {
      console.error(`Failed to process image for channel id ${channelInfo.channelId} (info id ${channelInfo.id}):`, e.message)
      throw e
    }
  }

  console.log('Done')
}

// same as in the ChannelService
function getChannelImageUrl (internalYoutubeChannelId: number, youtubeGlobalChannelInfoId: number) {
  return `channel/youtube/${internalYoutubeChannelId}/${youtubeGlobalChannelInfoId}.png`
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

function upsizeYoutubeImage (originalUrl: string) {
  // all images in the db conform to the standard where the size is given by `...=s64-...`, where 64 represents the image size in pixels.
  // turns out we can increase this size - if the underlying photo is smaller, youtube will upscale the image; otherwise, we get a better
  // quality image.
  const sizeStartIndex = originalUrl.indexOf('=s64-')
  if (sizeStartIndex < 0) {
    throw new Error('Could not find sizing information in the original URL')
  }

  return originalUrl.replace('=s64-', '=s1024-')
}

void main()
