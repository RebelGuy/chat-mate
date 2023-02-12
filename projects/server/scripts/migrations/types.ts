import ConsoleOutput from '../../../shared/util/ConsoleOutput'

export type MigrationFile = {
  type: 'schema' | 'data'
  timestamp: string
  name: string
  path: string
}

export type SchemaMigrationModel = {
  finished_at: Date,
  migration_name: string,
  logs: string,
  rolled_back_at: Date,
  started_at: Date,
  applied_steps_count: number
}

export type Counters = {
  run: number
  skipped: number
  error: number
}

export type DataMigration = {
  up: (input: { db: any, consoleOutput: ConsoleOutput }) => Promise<void>
}
