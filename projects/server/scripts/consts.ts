import { PrismaClient } from '@prisma/client'
import path from 'node:path'


export const IS_DEBUG = process.env.NODE_ENV === 'debug'

export const IS_LIVE = !IS_DEBUG

export const DATABASE_URL = process.env.DATABASE_URL!

// required so we get the most up-to-date client, even if the schema changes during the lifespan of the process
export const refreshDb = () => new PrismaClient({ datasources: { db: { url: DATABASE_URL }},  }) as PrismaClient

export const DB = refreshDb()

export const DB_NAME = IS_DEBUG ? 'chat_mate_debug' : 'chat_mate'

export const MIGRATIONS_FOLDER = path.join(__dirname, '../../../projects/server/prisma/migrations')

export const MIGRATION_SCRIPTS_FOLDER = path.join(__dirname, './migrations')

export const DATA_MIGRATION_EXT = '.ts'

export const DATA_MIGRATION_TEMPLATE = path.join(MIGRATION_SCRIPTS_FOLDER, '_dataMigrationTemplate.ts')
