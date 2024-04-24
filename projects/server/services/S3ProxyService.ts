import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import * as AWS from '@aws-sdk/client-s3'
import { ChatMateError } from '@rebel/shared/util/error'
import { NodeEnv } from '@rebel/server/globals'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Branded } from '@rebel/shared/types'

export type S3Image = {
  // this is the pure data without any dataUrl prefixes
  base64Data: string
  imageType: string
}

enum SignedUrlBrand {}

export type SignedUrl = Branded<string, SignedUrlBrand>

type Deps = Dependencies<{
  s3Region: string
  s3Domain: string
  s3Key: string
  s3Secret: string
  s3Bucket: string
  nodeEnv: NodeEnv
}>

// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html
// https://docs.digitalocean.com/products/spaces/reference/s3-compatibility/
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

  public constructAbsoluteUrl (fileName: string) {
    return `https://${this.bucket}.${this.domain}/${this.getBaseFolder()}/${fileName}`
  }

  public constructRelativeUrl (fileName: string) {
    return `${this.getBaseFolder()}/${fileName}`
  }

  // relativeUrl = baseFolder + fileName
  public async getImage (relativeUrl: string): Promise<S3Image | null> {
    const result = await this.client.send(new AWS.GetObjectCommand({
      Bucket: this.bucket,
      Key: relativeUrl
    }))

    if (result.ContentType == null || !result.ContentType.startsWith('image/')) {
      throw new ChatMateError(`Invalid content type ${result.ContentType} for image file ${relativeUrl}`)
    } else if (result.Body == null) {
      throw new ChatMateError(`Empty body returned for image file ${relativeUrl}`)
    }

    const data = await result.Body.transformToString('base64')
    const fileType = result.ContentType.replace('image/', '')
    return { base64Data: data, imageType: fileType }
  }

  public async signUrl (relativeUrl: string): Promise<SignedUrl> {
    const prefix = `https://${this.bucket}.${this.domain}/`
    if (relativeUrl.startsWith(prefix)) {
      relativeUrl = relativeUrl.substring(prefix.length)
    }

    const command = new AWS.GetObjectCommand({ Bucket: this.bucket, Key: relativeUrl })
    return await getSignedUrl(this.client, command) as SignedUrl
  }

  public async uploadBase64Image (fileName: string, fileType: string, isPublic: boolean, base64Data: string) {
    await this.client.send(new AWS.PutObjectCommand({
      Bucket: this.bucket,
      Key: this.constructRelativeUrl(fileName),
      Body: Buffer.from(base64Data, 'base64'),
      ACL: isPublic ? 'public-read' : 'private',
      ContentEncoding: 'base64',
      ContentType: `image/${fileType}`,
    }))

    const url = this.constructAbsoluteUrl(fileName)
    return await this.signUrl(url)
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
