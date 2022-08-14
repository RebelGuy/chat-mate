import { promptInput } from '@rebel/server/util/input'
import { toParamCase } from '@rebel/server/util/text'
import { execAsync } from '@rebel/server/util/node'
import path from 'node:path'
import { getAvailableMigrationsSorted, getOutstandingMigrationNames } from './util'
import env from '@rebel/server/globals'

// for some reason dotenv scripts don't propagate the --create-only parameter

const main = async () => {
  console.log('')

  // there is a weird Prisma quirk where you can't create a new migration until all other ones have been applied to the database.
  // this is unexpected behaviour, so make sure it is drawn to our attention.
  const outstandingMigrationNames = await getOutstandingMigrationNames()
  if (outstandingMigrationNames.length > 0) {
    console.log(`The following ${outstandingMigrationNames.length} migrations will be applied before a new migration can be created:`)
    outstandingMigrationNames.forEach(m => console.log(`  - ${m}`))
    console.log('')

    await promptInput('Hit enter to continue, or terminate the script now...')
    console.log('')
  }

  const name = await promptInput('? Enter a name for the new schema migration: » ')

  // there is supposed to be a --force flag that skips any prompts for when Prisma thinks the migration might
  // cause data loss. it is currently disabled, and since we are "in an interactive environment" there will be a crash.
  // https://github.com/prisma/prisma/blob/231670c50daa9d48b1f098b221e82c2e259c7748/packages/migrate/src/commands/MigrateDev.ts
  const command = `prisma migrate dev --create-only --name ${toParamCase(name)}`
  try {
    await execAsync(`yarn ${command}`)
  } catch (e) {
    console.log('')
    console.log('There was a problem, try running the command manually in the terminal:')

    // you can't pass `&` in the console
    const url = env('databaseUrl').replace(/&/g, '"&"')

    // don't use dotenv -e because for some reason it ignores the --create-only flag
    console.log(`  yarn cross-env NODE_ENV=debug DATABASE_URL=${url} ${command}`)
    console.log('')
    process.exit(0)
  }

  // open the migration file for editing
  const migration = getAvailableMigrationsSorted().at(-1)!
  const sqlFile = path.join(migration.path, 'migration.sql')
  await execAsync(`code -r ${sqlFile}`)

  process.exit(0)
}

void main()
