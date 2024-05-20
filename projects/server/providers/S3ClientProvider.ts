import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import * as AWS from '@aws-sdk/client-s3'

type Deps = Dependencies<{
  s3Region: string
  s3Domain: string
  s3Key: string
  s3Secret: string
}>

export default class S3ClientProvider extends SingletonContextClass {
  readonly client: AWS.S3Client

  constructor (deps: Deps) {
    super()

    this.client = new AWS.S3Client({
      endpoint: `https://${deps.resolve('s3Domain')}`,
      region: deps.resolve('s3Region'),
      credentials: {
        accessKeyId: deps.resolve('s3Key'),
        secretAccessKey: deps.resolve('s3Secret')
      }
    })
  }

  public get () {
    return this.client
  }
}
