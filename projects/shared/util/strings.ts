import * as crypto from 'crypto'

export function isNullOrEmpty (str: string | null | undefined): str is '' | null | undefined {
  return str == null || str.trim() === ''
}

export function nullIfEmpty (str: string | null | undefined): string | null {
  if (str == null || str.trim().length === 0) {
    return null
  } else {
    return str
  }
}

export function hashString (str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex')
}
