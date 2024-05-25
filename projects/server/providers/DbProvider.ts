import { Dependencies } from '@rebel/shared/context/context'
import LogService from '@rebel/server/services/LogService'
import { Prisma, PrismaClient } from '@prisma/client'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import Semaphore from '@rebel/shared/util/Semaphore'
import { DbError } from '@rebel/shared/util/error'
import { SafeOmit } from '@rebel/shared/types'

// remove properties from PrismaClient that we will never need
type UnusedPrismaProperties = '$on' | '$queryRawUnsafe' | '$connect' | '$disconnect' | '$use' | '$extends'

export type Db = SafeOmit<PrismaClient, UnusedPrismaProperties>

type Deps = Dependencies<{
  logService: LogService
  databaseUrl: string
  dbSemaphoreConcurrent: number
  dbSemaphoreTimeout: number | null
  dbSlowQueryThreshold: number
}>

export default class DbProvider extends SingletonContextClass {
  readonly name = DbProvider.name

  private readonly logService: LogService
  private readonly databaseUrl: string
  private readonly prismaClient: PrismaClient
  private readonly semaphore: Semaphore
  private readonly dbSlowQueryThreshold: number

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.databaseUrl = deps.resolve('databaseUrl')
    this.semaphore = new Semaphore(deps.resolve('dbSemaphoreConcurrent'), deps.resolve('dbSemaphoreTimeout'))
    this.dbSlowQueryThreshold = deps.resolve('dbSlowQueryThreshold')

    // inline options and definition required to enable event subscription below
    const client = new PrismaClient({
      datasources: { db: { url: this.databaseUrl }},
      errorFormat: 'pretty',
      rejectOnNotFound: false,
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ]
    })
    client.$on('query', e => {
      this.logService.logDebug(this, `(${e.duration} ms)`, e.query, e.params)
    })
    client.$on('info', e => {
      this.logService.logInfo(this, e.message)
    })
    client.$on('warn', e => {
      this.logService.logWarning(this, e.message)
    })

    // middleware for logging errors - this way we don't have to care about errors manually every time we use the client
    // https://www.prisma.io/docs/reference/api-reference/error-reference
    client.$use(async (params: Prisma.MiddlewareParams, next) => {
      // CHAT-362 by limiting the number of concurrent queries, we can reduce the chance of a database timeout.
      // furthermore, by manually timing out individual requests, we ensure that a long running query does
      // not cause too much traffic to build up - it is generally more desirable to time out after a number
      // of seconds, instead of having to wait for potentially minutes.
      await this.semaphore.enter()
      const startTime = Date.now()

      try {
        const result = await next(params)
        this.semaphore.exit()
        return result
      } catch (e: any) {
        this.semaphore.exit()
        this.logService.logWarning(this, 'Prisma encountered an error while trying to execute a request. Params:', params, 'Error:', e)

        // CHAT-362 During periods of dense traffic, the db can timeout and will remain in a broken state
        // until either the app is restarted, or the connection is reset.
        // we disconnect here, and the next request will automatically re-establish the connection.
        if (isPrismaTimeout(e)) {
          this.logService.logWarning(this, 'Detected Prisma timeout, now reconnecting to the database.')
          await this.prismaClient.$disconnect()
        }
        throw new DbError(e)
      } finally {
        const duration = Date.now() - startTime
        if (duration >= this.dbSlowQueryThreshold) {
          this.logService.logSlowQuery(duration, params)
        }
      }
    })

    this.prismaClient = client
  }

  public get (): Db {
    return this.prismaClient as Db
  }

  public override async initialise () {
    await this.prismaClient.$connect()
  }
}

function isPrismaTimeout (e: any) {
  const message = e.message as string | null
  return message != null && message.includes('Timed out fetching a new connection from the connection pool.')
}
