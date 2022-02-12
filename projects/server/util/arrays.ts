import { GenericObject, NumberOnly } from '@rebel/server/types'
import { assertUnreachable } from '@rebel/server/util/typescript'

// uses default equality comparison
export function unique<T> (array: T[]): T[] {
  const values: Set<T> = new Set()
  for (const value of array) {
    if (values.has(value)) {
      continue
    } else {
      values.add(value)
    }
  }

  return Array.from(values)
}

export function sortBy<T extends GenericObject> (array: T[], selector: (item: T) => number, direction?: 'asc' | 'desc'): T[]
export function sortBy<T extends GenericObject, K extends keyof NumberOnly<T>> (array: T[], key: K, direction?: 'asc' | 'desc'): T[]
export function sortBy<T extends GenericObject> (array: T[], selector: keyof T | ((item: T) => number), direction: 'asc' | 'desc' = 'asc'): T[] {
  let getValue: (item: T) => number
  if (typeof selector === 'string' || typeof selector === 'number' || typeof selector === 'symbol') {
    getValue = (item: T) => item[selector] as number
  } else if (typeof selector === 'function') {
    getValue = selector
  } else {
    assertUnreachable(selector)
  }

  return Array.from(array).sort((a: T, b: T) => {
    const x = getValue(a)
    const y = getValue(b)
    return direction === 'asc' ? x - y : y - x
  })
}

export function zip<T extends GenericObject, U extends GenericObject> (first: T[], second: U[]): (T & U)[] {
  if (first.length !== second.length) {
    throw new Error('Cannot zip arrays with different lengths')
  }

  return first.map((a, i) => ({ ...a, ...second[i] }))
}

/** Retrusn a new array that is the inverse of the input array. */
export function reverse<T> (arr: T[]): T[] {
  let result: T[] = []
  for (let i = arr.length - 1; i >= 0; i--) {
    result.push(arr[i])
  }
  return result
}
