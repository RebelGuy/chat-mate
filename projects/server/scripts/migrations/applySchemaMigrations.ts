require('../../_config')
import { execAsync } from '../../util/node'
import { promptInput } from '../../util/input'
import { getOutstandingMigrationNames } from './util'
import env from '@rebel/server/globals'

const main = async () => {
  const outstandingMigrationNames = await getOutstandingMigrationNames()
  if (outstandingMigrationNames.length > 0) {
    console.log(`Applying the following ${outstandingMigrationNames.length} migrations:`)
    outstandingMigrationNames.forEach(m => console.log(`  - ${m}`))
    console.log('')

    await promptInput('Hit enter to continue, or terminate the script now...')
    console.log('')

    const command = `yarn prisma migrate dev`
    try {
      await execAsync(`yarn ${command}`)
    } catch (e) {
      console.log('')
      console.log('There was a problem, try running the command manually in the terminal:')

      // don't use dotenv -e because for some reason it ignores the --create-only flag
      console.log(`  yarn cross-env NODE_ENV=debug DATABASE_URL=${env('databaseUrl')} ${command}`)
      console.log('')
      console.log('(you might also want to replace `dev` with `deploy` to force the migration without resetting the data')
      process.exit(0)
    }
  } else {
    console.log(`No migrations to apply. Use 'yarn migrate:schema' to create a new migration.`)
    console.log('')
  }

  process.exit(0)
}

console.log('')
main()
