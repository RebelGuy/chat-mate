import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import * as AWS from '@aws-sdk/client-s3'
import { ChatMateError } from '@rebel/shared/util/error'
import { NodeEnv } from '@rebel/server/globals'

export type S3Image = {
  base64Data: string
  imageType: string
}

type Deps = Dependencies<{
  s3Region: string
  s3Domain: string
  s3Key: string
  s3Secret: string
  s3Bucket: string
  nodeEnv: NodeEnv
}>

// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html
export default class S3ProxyService extends ContextClass {
  readonly domain: string
  readonly client: AWS.S3Client
  readonly bucket: string
  readonly nodeEnv: NodeEnv

  constructor (deps: Deps) {
    super()

    this.domain = deps.resolve('s3Domain')
    this.bucket = deps.resolve('s3Bucket')
    this.nodeEnv = deps.resolve('nodeEnv')

    this.client = new AWS.S3Client({
      endpoint: `https://${this.domain}`,
      region: deps.resolve('s3Region'),
      credentials: {
        accessKeyId: deps.resolve('s3Key'),
        secretAccessKey: deps.resolve('s3Secret')
      }
    })
  }

  public constructUrl (fileName: string) {
    return `https://${this.bucket}.${this.domain}/${this.getBaseFolder()}/${fileName}`
  }

  public async getImage (fileName: string): Promise<S3Image | null> {
    const result = await this.client.send(new AWS.GetObjectCommand({
      Bucket: this.bucket,
      Key: `${this.getBaseFolder()}/${fileName}`
    }))

    if (result.ContentType == null || !result.ContentType.startsWith('image/')) {
      throw new ChatMateError(`Invalid content type ${result.ContentType} for image file ${fileName}`)
    } else if (result.Body == null) {
      throw new ChatMateError(`Empty body returned for image file ${fileName}`)
    }

    const data = await result.Body.transformToString('base64')
    const fileType = result.ContentType.replace('image/', '')
    return { base64Data: data, imageType: fileType }
  }

  public async uploadBase64Image (fileName: string, fileType: string, isPublic: boolean, base64Data: string) {
    await this.client.send(new AWS.PutObjectCommand({
      Bucket: this.bucket,
      Key: `${this.getBaseFolder()}/${fileName}`,
      Body: Buffer.from(base64Data, 'base64'),
      ACL: isPublic ? 'public-read' : 'private',
      ContentEncoding: 'base64',
      ContentType: `image/${fileType}`,
    }))

    return this.constructUrl(fileName)
  }

  private getBaseFolder () {
    if (this.nodeEnv === 'debug') {
      return 'sandbox'
    } else if (this.nodeEnv === 'release') {
      return 'prod'
    } else if (this.nodeEnv === 'local') {
      return 'local'
    }
  }
}
