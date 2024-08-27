import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'

// set in the schema.prisma file
const MAX_ENDPOINT_LENGTH = 128
const MAX_PAYLOAD_LENGTH = 1024
const MAX_ERROR_LENGTH = 1024

export type ApiPlatform = 'youtubeApi' | 'twurple' | 'masterchat' | 'streamlabs'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class PlatformApiStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  public async addApiRequest (streamerId: number, platform: ApiPlatform, startTime: number, endTime: number, endpoint: string, payload: string | null, error: string | null) {
    await this.db.platformApiCall.create({ data: {
      streamerId: streamerId,
      start: new Date(startTime),
      end: new Date(endTime),
      endpoint: endpoint,
      platform: platform.substring(0, MAX_ENDPOINT_LENGTH),
      payload: payload?.substring(0, MAX_PAYLOAD_LENGTH) ?? null,
      error: error?.substring(0, MAX_ERROR_LENGTH) ?? null
    }})
  }

  /** Removes successful entries since the given time (inclusive) that match the given endpoint. */
  public async removeSuccessfulRequestsSince (since: number, endpoint: string): Promise<number> {
    return await this.db.$executeRaw`
      DELETE FROM platform_api_call
      WHERE end <= ${new Date(since)} AND error IS NULL AND endpoint LIKE ${endpoint}
    `
  }
}
