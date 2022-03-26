import { GenericObject, Nullify, NumberOnly, PrimitiveKeys } from '@rebel/server/types'
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

export function sortByLength (array: string[], direction?: 'asc' | 'desc'): string[] {
  return sortBy(array.map(str => ({ value: str })), item => item.value.length, direction).map(item => item.value)
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

/** Merges the two arrays on the specified key, which must be a common property. It is assumed that the key is unique within
 * an array, but may or may not be unique across the two arrays. No other properties should overlap between the objects, else
 * the behaviour is undefined. The arrays' lengths may differ. The return order is undefined. */
export function zipOn<T extends GenericObject, U extends GenericObject, Key extends (string | number | symbol) & PrimitiveKeys<T> & PrimitiveKeys<U>> (first: T[], second: U[], key: Key): (Pick<T & U, Key> & Partial<Omit<T & U, Key>>)[] {
  // for some reason we must explicitly define `Key extends (string | number | symbol)` otherwise Omit<> is unhappy
  let firstMap: Map<T[Key] & U[Key], Pick<T & U, Key> & Omit<Partial<T & U>, Key>> = new Map()
  let secondMap: Map<T[Key] & U[Key], Pick<T & U, Key> & Omit<Partial<T & U>, Key>> = new Map()
  
  for (const x of first) {
    const k = x[key]
    if (firstMap.has(k)) {
      throw new Error('The key should be unique within the first array')
    } else {
      const copy = { ...x }
      delete copy[key]
      firstMap.set(k, copy)
    }
  }

  for (const y of second) {
    const k = y[key]
    if (secondMap.has(k)) {
      throw new Error('The key should be unique within the second array')
    } else {
      const copy = { ...y }
      delete copy[key]
      secondMap.set(k, copy)
    }
  }

  let map: Map<T[Key] & U[Key], Pick<T & U, Key> & Omit<Partial<T & U>, Key>> = new Map()
  const allKeys = unique([...firstMap.keys(), ...secondMap.keys()])
  for (const k of allKeys) {
    const firstValue = firstMap.get(k) ?? {} as Omit<Partial<T & U>, Key>
    const secondValue = secondMap.get(k) ?? {} as Omit<Partial<T & U>, Key>

    const keyValue = { [key]: k } as Pick<T & U, Key>
    const finalValue = {
      ...keyValue,
      ...firstValue,
      ...secondValue
    }
    map.set(k, finalValue)
  }

  return [...map.values()]
}

/** Returns a new array that is the inverse of the input array. */
export function reverse<T> (arr: T[]): T[] {
  let result: T[] = []
  for (let i = arr.length - 1; i >= 0; i--) {
    result.push(arr[i])
  }
  return result
}

/** Returns the tally of each item, ordered from most frequent to least frequent. */
export function tally<T> (arr: T[], comparator?: (a: T, b: T) => boolean): { value: T, count: number }[] {
  if (comparator == null) {
    comparator = (a: T, b: T) => a === b
  }

  let result: { value: T, count: number }[] = []
  for (const item of arr) {
    const existing = result.find(r => comparator!(r.value, item))
    if (existing == null) {
      result.push({ value: item, count: 1 })
    } else {
      existing.count++
    }
  }

  return sortBy(result, r => r.count, 'desc')
}

/** Assigns items to single-member groups on a first-come, first-serve basis. The resulting array is also ordered. */
export function groupedSingle<T, G> (arr: T[], grouper: (item: T) => G): T[] {
  let groups: Set<G> = new Set()
  let result: T[] = []

  for (const item of arr) {
    const group = grouper(item)
    if (!groups.has(group)) {
      groups.add(group)
      result.push(item)
    }
  }

  return result
}

/** Assigns items to single-member subgroups, where there can be any number of subgroups per main group. The order of
 * the subgroups (inner array) has the same ordering as the supplied items, but the main group is unordered. */
export function subGroupedSingle<T, G, S> (arr: T[], mainGrouper: (item: T) => G, subGrouper: (item: T) => S): { group: G, subgrouped: T[] }[] {
  let groups: Map<G, Set<S>> = new Map()
  let resultingMap: Map<G, T[]> = new Map()

  for (const item of arr) {
    const mainGroup = mainGrouper(item)
    const subGroup = subGrouper(item)

    if (groups.has(mainGroup)) {
      const existingSubGroups = groups.get(mainGroup)!
      if (!existingSubGroups.has(subGroup)) {
        existingSubGroups.add(subGroup)
        resultingMap.get(mainGroup)!.push(item)
      }
    } else {
      groups.set(mainGroup, new Set([subGroup]))
      resultingMap.set(mainGroup, [item])
    }
  }

  let result: { group: G, subgrouped: T[] }[] = []
  for (const [group, values] of resultingMap) {
    result.push({
      group: group,
      subgrouped: values
    })
  }
  return result
}
