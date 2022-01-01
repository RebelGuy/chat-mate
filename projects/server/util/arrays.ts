// uses default equality comparison
export function unique<T> (array: T[]): T[] {
  const unique: Set<T> = new Set()
  for (const value of array) {
    if (unique.has(value)) {
      continue
    } else {
      unique.add(value)
    }
  }

  return Array.from(unique)
}
