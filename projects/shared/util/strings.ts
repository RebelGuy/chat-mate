import * as crypto from 'crypto'

export function isNullOrEmpty (str: string | null | undefined): boolean {
  return str == null || str.trim() === ''
}

export function hashString (str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex')
}
