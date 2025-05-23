import { PrismaClient } from '@prisma/client'
import env, { NodeEnv } from '@rebel/server/globals'
import DbProvider from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import { cast } from '@rebel/shared/testUtils'
import { NO_OP } from '@rebel/shared/util/typescript'
import path from 'node:path'

export const NODE_ENV = env('nodeEnv')

export const DATABASE_URL = env('databaseUrl')

export const TWITCH_CLIENT_ID = env('twitchClientId')

export const TWITCH_CLIENT_SECRET = env('twitchClientSecret')

export const TWITCH_USERNAME = env('twitchUsername')

export const CHANNEL_ID = env('channelId')

export const MINIO_PATH = env('minioPath')!

// required so we get the most up-to-date client, even if the schema changes during the lifespan of the process
export const refreshDb = () => new PrismaClient({ datasources: { db: { url: DATABASE_URL }},  }) as PrismaClient

export const DB = refreshDb()

export const DB_PROVIDER = { get: () => DB } as Pick<DbProvider, 'get'> as DbProvider

export const MIGRATIONS_FOLDER = path.join(__dirname, '../../projects/server/prisma/migrations')

export const MIGRATION_SCRIPTS_FOLDER = path.join(__dirname, './migrations')

export const DATA_MIGRATION_TEMPLATE = path.join(MIGRATION_SCRIPTS_FOLDER, '_dataMigrationTemplate.ts')

export const ARGS = process.argv.slice(2)

export const LOG_SERVICE: LogService = cast<LogService>({
  logDebug: NO_OP,
  logInfo: NO_OP,
  logWarning: NO_OP,
  logError: NO_OP,
  logApiRequest: NO_OP,
  logApiResponse: NO_OP,
  logSlowQuery: NO_OP
})
