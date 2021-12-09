import { DATA_MIGRATION_EXT, DATA_MIGRATION_TEMPLATE, MIGRATIONS_FOLDER } from './consts'
import { promptInput } from '../../util/input'
import { copyFileSync } from 'fs-extra'
import { join as pathJoin } from 'node:path'
import { toParamCase } from '../../util/text'

// "inspired" by https://github.com/redwoodjs/redwood/blob/main/packages/cli/src/commands/generate/dataMigration/dataMigration.js
throw new Error('Not yet supported')

// the problem here is that everything seems to work, except the Prisma client may not be up-to-date.
// consider the following three migrations, which have been defined but not yet applied:
// - 1. schema migration: add new optional column
// - 2. data migration: fill in the optional column for all entries
// - 3. schema migration: make the column non-optional
// At the time of writing migration 2, the client version will still be as it was before writing migration 1.
// So attempting to use the new column (even if any-typing) will throw an error.
// Even automatically running `prisma generate` before each data migration does not work, because the generated
// client builds on the CURRENT prisma file (i.e. AFTER migration 3), so it's not very useful.
// A possible workaround may be to store within each schema migration folder a copy of the prisma file as it was
// at the time of writing that migration, and using this file to generate the client before executing a data migration.
// It may even be possible to generate a client for each data migration individually (e.g. will be placed in the same
// folder as the migration file) for a type-safe approach. It is possible to define the output path of the generated client,
// so this is definitely a possible (and perhaps the safest) approach. To avoid checking the client into source control,
// we could also place the corresponding prisma file in the same data migration folder, and add a script to derive the
// client.

// when implementing this, ensure the schema.prisma file is updated to include the table for storing data migrations:
/*
model DataMigration {
  id            Int      @id @default(autoincrement())
  migrationName String   @map("migration_name")
  startedAt     DateTime @map("started_at")
  finishedAt    DateTime @map("finished_at")

  @@map("_data_migrations")
}
*/

const main = async () => {
  const name = await promptInput('? Enter a name for the new data migration: » ')
  const now = new Date().toISOString()
  const timestamp = now.split('.')[0].replace(/\D/g, '')
  const outputFilename = `${timestamp}_${toParamCase(name)}${DATA_MIGRATION_EXT}`
  const outputPath = pathJoin(MIGRATIONS_FOLDER, outputFilename)
  copyFileSync(DATA_MIGRATION_TEMPLATE, outputPath)
  process.exit(0)
}

main()
