import { PrismaClient } from '@prisma/client'
import path from 'node:path'


export const IS_DEBUG = process.env.NODE_ENV === 'debug'

// required so we get the most up-to-date client, even if the schema changes during the lifespan of the process
export const refreshDb = () => new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL }} }) as PrismaClient

export const DB = refreshDb()

export const DB_NAME = IS_DEBUG ? 'test' : 'chat_mate'

export const MIGRATIONS_FOLDER = path.join(__dirname, '../../../../../projects/server/prisma/migrations')

export const MIGRATION_SCRIPTS_FOLDER = path.join(__dirname, './')

export const DATA_MIGRATION_EXT = '.ts'

export const DATA_MIGRATION_TEMPLATE = path.join(MIGRATION_SCRIPTS_FOLDER, '_dataMigrationTemplate.ts')
