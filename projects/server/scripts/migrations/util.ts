import { DB, MIGRATIONS_FOLDER } from '../consts'
import { MigrationFile } from './types'
import * as fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'

export async function getAppliedMigrations (): Promise<string[]> {
  try {
    const queryResult: any[] = await DB.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL;`
    return queryResult.map(m => m.migration_name as string)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.message.includes("_prisma_migrations' doesn't exist")) {
        return []
      }
    }
    throw e
  }
}

export function getAvailableMigrationsSorted (): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_FOLDER)) {
    console.log(`Migrations folder ${MIGRATIONS_FOLDER} does not exist`)
    console.log('')
    return []
  }

  return fs.readdirSync(MIGRATIONS_FOLDER)
    .filter(m => {
      const fullPath = path.join(MIGRATIONS_FOLDER, m)
      if (!fs.statSync(fullPath).isDirectory()) {
        return false
      }

      const files = fs.readdirSync(fullPath)
      return files.length === 1 && files[0] === 'migration.sql'
    })
    .map(m => {
      const migrationPath = path.join(MIGRATIONS_FOLDER, m)
      return {
        type: 'schema',
        name: path.basename(migrationPath),
        timestamp: m.split('_')[0],
        path: migrationPath,
      } as MigrationFile
    })
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
}

// returns the migrations that haven't been applied yet (generally 0 or 1)
export async function getOutstandingMigrationNames(): Promise<string[]> {
  const appliedMigrationNames = await getAppliedMigrations()
  const availableMigrationNames = getAvailableMigrationsSorted().map(m => m.name)

  return availableMigrationNames.filter(m => !appliedMigrationNames.includes(m))
}