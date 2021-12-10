import { promptInput } from '../../util/input'
import { toParamCase } from '../../util/text'
import { execAsync } from '../../util/node'
import path from 'node:path'
import { getAvailableMigrationsSorted, getOutstandingMigrationNames } from './util'

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
  const command = `yarn prisma migrate dev --create-only --name ${toParamCase(name)}`
  await execAsync(command)

  // open the migration file for editing
  const migration = getAvailableMigrationsSorted().at(-1)!
  const sqlFile = path.join(migration.path, 'migration.sql')
  await execAsync(`code -r ${sqlFile}`)

  process.exit(0)
}

main()
