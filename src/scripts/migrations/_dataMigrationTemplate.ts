import { PrismaClient } from '@prisma/client'
import { DataMigration } from '../../src/scripts/migrations/types'

const migration: DataMigration = {
  up: async ({ db, consoleOutput }) => {
    await db.$transaction([
      db.user.create({ data: { name: 'George' } }),
      db.user.create({ data: { name: 'Bob' } }),
      db.user.create({ data: { name: 'Alice' } })
    ])
  }
}

export default migration
