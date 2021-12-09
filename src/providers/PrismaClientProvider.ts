import { Dependencies } from '@rebel/context/context';
import IProvider from '@rebel/providers/IProvider';
import { IMasterchat } from '@rebel/interfaces';
import MockMasterchat from '@rebel/mocks/MockMasterchat'
import FileService from '@rebel/services/FileService'
import LogService from '@rebel/services/LogService'
import { Masterchat } from 'masterchat';
import { Prisma, PrismaClient } from '@prisma/client'

export default class PrismaClientProvider implements IProvider<PrismaClient> {
  readonly name = PrismaClientProvider.name

  private readonly fileService: FileService
  private readonly logService: LogService
  private readonly databaseUrl: string
  private readonly prismaClient: PrismaClient

  constructor (deps: Dependencies) {
    this.fileService = deps.resolve<FileService>(FileService.name)
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

  public get (): PrismaClient {
    return this.prismaClient
  }
}
