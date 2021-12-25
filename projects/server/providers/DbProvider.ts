import { Dependencies } from '@rebel/server/context/context'
import IProvider from '@rebel/server/providers/IProvider'
import LogService from '@rebel/server/services/LogService'
import { Prisma, PrismaClient } from '@prisma/client'

// remove properties from PrismaClient that we will never need
type UnusedPrismaProperties = '$on' | '$queryRawUnsafe' | '$executeRawUnsafe' | '$connect' | '$disconnect' | '$use'

export type Db = Omit<PrismaClient, UnusedPrismaProperties>

type Deps = Dependencies<{
  logService: LogService
  databaseUrl: string
}>

export default class DbProvider implements IProvider<Db> {
  readonly name = DbProvider.name

  private readonly logService: LogService
  private readonly databaseUrl: string
  private readonly prismaClient: PrismaClient

  private connected: boolean = false

  constructor (deps: Deps) {
    this.logService = deps.resolve('logService')
    this.databaseUrl = deps.resolve('databaseUrl')

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
    client.$on('error', e => {
      this.logService.logError(this, e.message)
    })

    // middleware for logging errors - this way we don't have to care about errors manually every time we use the client
    // https://www.prisma.io/docs/reference/api-reference/error-reference
    client.$use(async (params: Prisma.MiddlewareParams, next) => {
      try {
        return await next(params)
      } catch (e: any) {
        this.logService.logError(this, 'Prisma encountered an error while trying to execute a request.')
        this.logService.logError(this, 'PARAMS:', params)
        this.logService.logError(this, 'ERROR:', e)
        this.logService.logError(this, 'MESSAGE:', e.message)
        this.logService.logError(this, 'STACK:', e.stack)
        throw e
      }
    })

    this.prismaClient = client
  }

  public get (): Db {
    if (!this.connected) {
      // don't wait until the first query to connect, in case there is an issue
      this.connected = true
      this.prismaClient.$connect()
    }
    return this.prismaClient as Db
  }
}
