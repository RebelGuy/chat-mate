import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime/library'
import { DbError } from '@rebel/shared/util/error'

// https://www.prisma.io/docs/reference/api-reference/error-reference
export const PRISMA_CODE_UNIQUE_CONSTRAINT_FAILED = 'P2002'

export const PRISMA_CODE_DOES_NOT_EXIST = 'P2025'

export function isKnownPrismaError (e: any): e is DbError<PrismaClientKnownRequestError> {
  return e instanceof DbError && e.innerError instanceof PrismaClientKnownRequestError
}

export function isUnknownPrismaError (e: any): e is DbError<PrismaClientUnknownRequestError> {
  return e instanceof DbError && e.innerError instanceof PrismaClientUnknownRequestError
}
