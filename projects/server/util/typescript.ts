import { ObjectComparator, ValueComparator } from '@rebel/server/types'
import { values } from '@rebel/server/util/arrays'

export function assert (condition: any, msg: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}

// returns false for null values
export function isPrimitive (value: any): value is boolean | number | string | symbol | bigint {
  return (typeof value !== 'object' && typeof value !== 'function') || value == null
}

// returns false for null values
export function isReferenceType (value: any): value is object {
  return value != null && (typeof value === 'object' || typeof value === 'function')
}

// null and undefined are considered primitive, but distingushable
export function comparePrimitives<T> (a: T, b: T, ...ignoreKeys: (keyof T)[]): boolean {
  const allKeys = Object.keys(a) as (keyof T)[]
  for (const prop of allKeys.filter(k => !ignoreKeys.includes(k))) {
    const value1: unknown = a[prop]
    const value2: unknown = b[prop]
  
    if (isPrimitive(value1) || isPrimitive(value2)) {
      if (value1 === value2) {
        continue
      }
    } else if (isReferenceType(value1) || isReferenceType(value2)) {
      continue
    } else {
      if (value1 === null && value2 === null) {
        continue
      } else if (value1 === undefined && value2 === undefined) {
        continue
      }
    }

    return false
  }

  return true
}

export function compare<T> (a: T, b: T, comparator: ObjectComparator<T>) {
  const allKeys = Object.keys(comparator) as (keyof T)[]

  for (const key of allKeys) {
    const c: ValueComparator<T[keyof T]> = comparator[key]
    if (c == null) {
      continue
    }
    
    const v1 = a[key]
    const v2 = b[key]
    if (c === 'default') {
      if (v1 !== v2) {
        return false
      }
    } else if (!c(v1, v2)) {
      return false
    }
  }

  return true
}

export function assertUnreachable (x: never): never {
  throw new Error('This should not happen')
}

/** Used as a type-guard during compile-time to check completeness of implementations, but has no effect on runtime code. */
export function assertUnreachableCompile (x: never): any { return }

/** Asserts that the property of the given variable is not identically null. */
export function assertNotNull<T, K extends keyof T> (x: T, key: K, msg: string): asserts x is { [P in keyof T]: P extends K ? Exclude<T[P], null> : T[P] } {
  if (x != null && x[key] === null) {
    throw new Error(msg)
  }
}

/** This function's sole purpose is to remind us of some required implementation updates if a property of type T changes. */
export function reminder<T extends string> (x: Record<T, true>): void { /* no op */ }

export function firstOrDefault<T, Default> (map: Map<any, T>, def: Default): T | Default {
  const v = values(map ?? new Map())
  return v.length === 0 ? def : v[0]
}
