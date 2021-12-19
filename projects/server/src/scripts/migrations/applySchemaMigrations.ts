import { execAsync } from '../../util/node'
import { promptInput } from '../../util/input'
import { getOutstandingMigrationNames } from './util'

const main = async () => {
  const outstandingMigrationNames = await getOutstandingMigrationNames()
  if (outstandingMigrationNames.length > 0) {
    console.log(`Applying the following ${outstandingMigrationNames.length} migrations:`)
    outstandingMigrationNames.forEach(m => console.log(`  - ${m}`))
    console.log('')

    await promptInput('Hit enter to continue, or terminate the script now...')
    console.log('')
    await execAsync(`yarn prisma migrate dev`)
  } else {
    console.log(`No migrations to apply. Use 'yarn migrate:schema' to create a new migration.`)
    console.log('')
  }

  process.exit(0)
}

console.log('')
main()
