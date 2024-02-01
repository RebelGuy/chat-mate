import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { Singular } from '@rebel/shared/types'
import { compareArrays } from '@rebel/shared/util/arrays'
import { formatDate, formatTime } from '@rebel/shared/util/datetime'
import { toConstCase } from '@rebel/shared/util/text'
import { isNullable, isPrimitive } from '@rebel/shared/util/typescript'
import { ChatMateError } from '@rebel/shared/util/error'

// for some reason this unions all tables instead of creating a type whose properties are the tables.
// probably it's got to do with the `readonly` modifies of the tables.
type DbTable = {
  [K in keyof Db]: Db[K] extends (...args: any[]) => any ? never : Db[K]
}[keyof Db] // get rid of the `never`s

type DbTableName = Exclude<keyof Db, '$executeRaw' | '$queryRaw' | '$transaction'>

// I got these step by step by just following the types in the PrismaClient decleration file
type Columns<T extends DbTable> = T['createMany'] extends (args: infer CreateManyArgs) => any
  ? CreateManyArgs extends { data: infer CreateManyInput }
    ? Singular<CreateManyInput>
    : never
  : never

// @ts-ignore (too much recursion for typescript, but blame prisma not me. it still seems to enforce the data type correctly)
export type ReplacementData<Table extends DbTableName> = Columns<Db[Table]> & { id: number }

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class GenericStore extends ContextClass {
  protected readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  /** It is assumed that `id` is the primary column of the table.
   * Resolves if the entries were replaced successfully. For safety, it is recommended to not update any unique foreign keys, as a constraint failure leads to undefined behaviour.
   * **Important: all data objects must contain the exact same keys.**
   * **Important: it is the caller's responsibility to ensure that the id they provide already exists - otherwise, new entries would get created and this request will fail.** */
  public async replaceMany<Table extends DbTableName> (table: Table, dataToReplace: ReplacementData<Table>[]) {
    // it is assumed that `id` is the primary key of the table.
    // inspired by https://stackoverflow.com/a/34866431

    if (dataToReplace.length === 0) {
      return
    }

    // ???????????? why is it not recognising `id` as a property when it's CLEARLY typed
    const uniqueUpdates = [...new Set(dataToReplace.map(x => (x as any).id))]
    if (uniqueUpdates.length !== dataToReplace.length) {
      throw new ChatMateError('All data that is being replaced must refer to distinct existing entires')
    }

    const allColumns = Object.keys(dataToReplace[0]).sort()
    for (const data of dataToReplace) {
      const keys = Object.keys(data).sort()
      if (!compareArrays(allColumns, keys)) {
        throw new ChatMateError('All replacement data must have the exact same keys')
      }
    }

    const dataColumns = allColumns.filter(c => c !== 'id')
    const dbTable = mappedTableToDbTable(table)

    // the transaction ensures that we can verify that nothing went wrong before committing the changes
    await this.db.$transaction(async (db) => {
      // sadly this cast is necessary as `db[table]` unions all table types into one type and causes big problems
      const currentRows: number = await (db[table] as any).count()

      // we need to use `executeRawUnsafe` because the safe version doesn't allow us to use templates for identifiers (e.g. table names or column names)
      await db.$executeRawUnsafe(`
        INSERT INTO ${dbTable} (${allColumns.join(',')})
        VALUES
          ${dataToReplace.map(x => `(${allColumns.map(col => sqlise(x[col]))})`).join(',')}
        ON DUPLICATE KEY UPDATE
          ${dataColumns.map(col => `${col}=VALUES(${col})`).join(',')}
      `)

      const finalRows: number = await (db[table] as any).count()
      if (currentRows !== finalRows) {
        throw new ChatMateError(`Unable to replace entries in ${table}`)
      }
    })
  }
}

function mappedTableToDbTable (mappedName: string) {
  return toConstCase(mappedName).toLowerCase()
}

function sqlise (value: any): string {
  if (value instanceof Date) {
    return `'${formatDate(value, true)} ${formatTime(value, true)}'`
  } else if (isNullable(value)) {
    return 'NULL'
  } else if (isPrimitive(value)) {
    return `'${JSON.stringify(value)}'`
  } else {
    throw new ChatMateError('Invalid value ' + JSON.stringify(value))
  }
}
