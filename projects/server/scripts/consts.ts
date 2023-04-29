import { PrismaClient } from '@prisma/client'
import path from 'node:path'

export const DATABASE_URL = process.env.DATABASE_URL!

export const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!

export const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!

export const TWITCH_USERNAME = process.env.TWITCH_USERNAME!

// required so we get the most up-to-date client, even if the schema changes during the lifespan of the process
export const refreshDb = () => new PrismaClient({ datasources: { db: { url: DATABASE_URL }},  }) as PrismaClient

export const DB = refreshDb()

export const MIGRATIONS_FOLDER = path.join(__dirname, '../../projects/server/prisma/migrations')

export const MIGRATION_SCRIPTS_FOLDER = path.join(__dirname, './migrations')

export const DATA_MIGRATION_TEMPLATE = path.join(MIGRATION_SCRIPTS_FOLDER, '_dataMigrationTemplate.ts')
