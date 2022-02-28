export function isNullOrEmpty (str: string | null | undefined): boolean {
  return str == null || str.trim() === ''
}
