export function isPrismaNotFoundError (e: any) {
  return e instanceof Error && e.name === 'NotFoundError'
}
