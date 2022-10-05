// @ts-nocheck
import { Prisma } from '@prisma/client'
import * as fs from 'node:fs'
import * as fsx from 'fs-extra'
import path from 'node:path'
import Listr from 'listr'
import { Counters, DataMigration, MigrationFile } from './types'
import { DATA_MIGRATION_EXT, DB, DB_NAME, IS_DEBUG, MIGRATIONS_FOLDER } from './consts'
import { execAsync } from '../../util/node'
import ConsoleOutput from '../../util/ConsoleOutput'

// "inspired" by https://github.com/redwoodjs/redwood/blob/54fe779a48b2dfb023262a528a88d8ea59701d50/packages/cli/src/commands/dataMigrate/up.js
// run using
//   yarn dotenv -e debug.env ts-node ./src/scripts/migrations/applyMigrations.ts

throw new Error('Not yet supported')
// see the comment in migrateData.ts

// sorts migrations by date, oldest first
const sortMigrations = (migrations: MigrationFile[]) => {
  return migrations.sort((a, b) => {
    const aVersion = a.timestamp
    const bVersion = b.timestamp

    if (aVersion > bVersion) {
      return 1
    }
    if (aVersion < bVersion) {
      return -1
    }
    return 0
  })
}

// Return the list of migrations that haven't run against the database yet
const getMigrations = async () => {
  if (!fs.existsSync(MIGRATIONS_FOLDER)) {
    return []
  }

  // gets all migrations present in the app
  const files = fs.readdirSync(MIGRATIONS_FOLDER)
    .map(m => {
      const migrationPath = path.join(MIGRATIONS_FOLDER, m)
      let type: 'data' | 'schema'
      let name: string
      if (path.extname(m) === DATA_MIGRATION_EXT) {
        type = 'data'
        name =  path.basename(migrationPath, DATA_MIGRATION_EXT)
      } else if (fs.statSync(migrationPath).isDirectory()) {
        type = 'schema'
        name = path.basename(migrationPath)
      } else {
        return null
      }

      return {
        type,
        name,
        timestamp: m.split('_')[0],
        path: migrationPath,
      } as MigrationFile
    }).filter(m => m != null) as MigrationFile[]

  // gets all migration versions that have already run against the database
  const ranSchemaMigrations = (await DB.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL;` as any[])
    .map(m => m.migration_name as string)
  const ranDataMigrations = (await DB.dataMigration.findMany({
    orderBy: { migrationName: 'asc' },
  })).map(m => m.migrationName)
  const ranMigrations = [...ranSchemaMigrations, ...ranDataMigrations]

  const unrunMigrations = files.filter(m => !ranMigrations.includes(m.name))

  return sortMigrations(unrunMigrations)
}

// adds data for completed migrations to the DB
const recordDataMigration = async (data: Prisma.DataMigrationCreateInput) => {
  await DB.dataMigration.create({ data })
}

// output run status to the console
const report = (counters: Counters) => {
  console.log('')
  if (counters.run) {
    console.info(`${counters.run} data migration(s) completed successfully.`)
  }
  if (counters.error) {
    console.error(`${counters.error} data migration(s) exited with errors.`)
  }
  if (counters.skipped) {
    console.warn(`${counters.skipped} data migration(s) skipped due to previous error.`)
  }
  console.log('')
}

const runMigration = async (migration: MigrationFile, sortedMigrationFiles: ReadonlyArray<MigrationFile>, consoleOutput: ConsoleOutput) => {

  if (migration.type === 'data') {
    const script = (await import(migration.path)).default as DataMigration
    const startedAt = new Date()
    await script.up({ db: DB, consoleOutput })
    const finishedAt = new Date()
    await recordDataMigration({ migrationName: migration.name, startedAt, finishedAt })
    return null

  } else {
    // if there are multiple successive schema migrations, we can just run them all at once
    const runUntilTimestamp = sortedMigrationFiles.find(m => m.type === 'data' && m.timestamp > migration.timestamp)?.timestamp
    let moveMigrations: MigrationFile[] = []
    if (runUntilTimestamp) {
      moveMigrations = sortedMigrationFiles.filter(m => m.type === 'schema' && m.timestamp > runUntilTimestamp)
    }
    fs.mkdirSync('./.temp')
    moveMigrations.forEach(m => fsx.moveSync(m.path, path.join(m.path, './.temp')))

    try {
      await execAsync(`yarn prisma migrate ${IS_DEBUG ? 'dev' : 'deploy'}`, consoleOutput)
    } catch (e: any) {
      // capture the error so we know what the problem is
      throw new Error(consoleOutput.stderr)
    }
    moveMigrations.forEach(m => fsx.moveSync(path.join(m.path, './.temp'), m.path))
    fs.rmdirSync('./.temp')
  }
}

export const main = async () => {
  const migrations = await getMigrations()

  // exit immediately if there aren't any migrations to run
  if (!migrations.length) {
    console.info('\nNo migrations run, already up-to-date.\n')
    process.exit(0)
  }

  const counters: Counters = { run: 0, skipped: 0, error: 0 }
  const migrationTasks = migrations.map(migration => {
    return {
      title: `${migration.name} [${migration.type.toUpperCase()}]`,
      skip: () => {
        if (counters.error > 0) {
          counters.skipped++
          return true
        }
      },
      task: async () => {
        // make sure we don't interfere with the listr output
        const consoleOutput = new ConsoleOutput()
        try {
          console.log(`Running ${migration.type} migration ${migration.name}`)
          await runMigration(migration, migrations, consoleOutput)
          if (consoleOutput.stderr) {
            console.log('Migration was successful')
            console.log(consoleOutput.stderr)
          }
          counters.run++
        } catch (e: any) {
          counters.error++
          console.error(`Error in ${migration.type} migration ${migration.name}: ${e.message}`)
          console.error('More info:')
          console.error(consoleOutput.stderr)
        }
      },
    }
  })

  const tasks = new Listr(migrationTasks)

  try {
    await tasks.run()
    await DB.$disconnect()
    report(counters)
  } catch (e: any) {
    await DB.$disconnect()
    report(counters)
    process.exit(e?.exitCode || 1)
  }
}

main()
