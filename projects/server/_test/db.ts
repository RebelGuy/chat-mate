import { PrismaClient, PrismaPromise } from '@prisma/client'
import { DeepMockProxy, mockDeep } from 'jest-mock-extended'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import env from '@rebel/server/globals'
import { Dependencies } from '@rebel/server/context/context'
import LogService from '@rebel/server/services/LogService'

export async function setupTestDb (): Promise<DbProvider> {
  const dbProvider = new DbProvider(new Dependencies({
    logService: mockDeep<LogService>(),
    databaseUrl: env('databaseUrl')
  }))

  // casting is fine because dbProvider actually returns the full object
  const client = dbProvider.get() as PrismaClient
  await clearDatabase(client)

  return dbProvider
}

async function clearDatabase (client: PrismaClient) {
  // from https://www.prisma.io/docs/concepts/components/prisma-client/crud#deleting-all-data-with-raw-sql--truncate
  const transactions: PrismaPromise<any>[] = []
  transactions.push(client.$executeRaw`SET FOREIGN_KEY_CHECKS = 0;`)

  const tablenames = await client.$queryRaw<Array<{ tablename: string }>>`SELECT TABLE_NAME as tablename from information_schema.TABLES WHERE TABLE_SCHEMA='chat_mate_test';`

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      transactions.push(client.$executeRawUnsafe(`TRUNCATE ${tablename};`))
    }
  }

  transactions.push(client.$executeRaw`SET FOREIGN_KEY_CHECKS = 1;`)

  await client.$transaction(transactions)
}

// can be chained directly with toBe(), and the whole chain must be awaited
export function expectRowCount<Tables extends any[]>(...tables: Tables)
  : jest.AndNot<jest.Matchers<Promise<void>, Promise<Tables['length'] extends 1 ? number : number[]>>>
  {
  const getRowCount = (table: any): number => table.count()

  if (tables.length === 1) {
    return expect(getRowCount(tables[0])).resolves
  } else {
    return expect(Promise.all(tables.map(table => getRowCount(table)))).resolves
  }
}

/*

// note: it IS possible to mock the prisma client, but it is a lot of work and
// pretty much has to mirror the implementation, which is not very useful.

// e.g. return database object when findUnique is called:
mockDb.channel.findUnique.mockResolvedValue({ id: 1, youtubeId: 'mockId' })
const result = await channelStore.exists('mockId')
expect(result).toBe(true)

// e.g. return result based on arguments when findUnique is called:
mockDb.channel.findUnique.mockImplementation(args => {
  if (args.where.youtubeId === 'mockId') {
    return null!
  } else {
    throw new Error()
  }
})
const result = await channelStore.exists('mockId')
expect(result).toBe(false)

*/