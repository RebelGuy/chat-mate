import { Dependencies } from '@rebel/context/context'
import IProvider from '@rebel/providers/IProvider'
import LogService from '@rebel/services/LogService'
import { PrismaClient } from '@prisma/client'

// remove properties from PrismaClient that we will never need
type UnusedPrismaProperties = '$on' | '$queryRawUnsafe' | '$executeRawUnsafe' | '$connect' | '$disconnect' | '$use'

export type Db = Omit<PrismaClient, UnusedPrismaProperties>

export default class DbProvider implements IProvider<Db> {
  readonly name = DbProvider.name

  private readonly logService: LogService
  private readonly databaseUrl: string
  private readonly prismaClient: PrismaClient

  constructor (deps: Dependencies) {
    this.logService = deps.resolve<LogService>(LogService.name)
    this.databaseUrl = deps.resolve<string>('databaseUrl')

    // inline options and definition required to enable event subscription below
    const client = new PrismaClient({
      datasources: { db: { url: this.databaseUrl }},
      errorFormat: 'pretty',
      rejectOnNotFound: true,
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ]
    })
    client.$on('query', e => {
      this.logService.logDebug(this, `(${e.duration} ms)`, e.query)
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

    this.prismaClient = client
  }

  public get (): Db {
    return this.prismaClient as Db
  }
}
