import { promptInput } from '../../util/input'
import { toParamCase } from '../../util/text'
import { execAsync } from '../../util/node'
import path from 'node:path'
import * as fs from 'fs'
import { MIGRATIONS_FOLDER } from './consts'
import { MigrationFile } from './types'

// for some reason dotenv scripts don't propagate the --create-only parameter

const main = async () => {
  const name = await promptInput('? Enter a name for the new schema migration: » ')
  const command = `yarn prisma migrate dev --create-only --name ${toParamCase(name)}`
  await execAsync(command)

  // open the migration file for editing
  const migration = fs.readdirSync(MIGRATIONS_FOLDER)
    .map(m => {
      const migrationPath = path.join(MIGRATIONS_FOLDER, m)
      return {
        type: 'schema',
        name: path.basename(migrationPath),
        timestamp: m.split('_')[0],
        path: migrationPath,
      } as MigrationFile
    })
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .at(0)
  const sqlFile = path.join(migration.path, 'migration.sql')
  await execAsync(`code -r ${sqlFile}`)

  process.exit(0)
}

main()
