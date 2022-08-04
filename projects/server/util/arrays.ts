import { GenericObject, Nullify, NumberOnly, Primitive, PrimitiveKeys } from '@rebel/server/types'
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

export function single<T> (array: T[]): T {
  if (array.length === 1) {
    return array[0]
  } else {
    throw new Error(`Expected 1 element in the array but found ${array.length}`)
  }
}

export function singleOrNull<T> (array: T[]): T | null {
  if (array.length === 0) {
    return null
  } else if (array.length === 1) {
    return array[0]
  } else {
    throw new Error(`Expected 0 or 1 elements in the array but found ${array.length}`)
  }
}

export function sortByLength (array: string[], direction?: 'asc' | 'desc'): string[] {
  return sortBy(array.map(str => ({ value: str })), item => item.value.length, direction).map(item => item.value)
}

/** Sort by number. */
export function sortBy<T extends GenericObject> (array: T[], selector: (item: T) => number, direction?: 'asc' | 'desc'): T[]
/** Sort by string comparison (case sensitive). */
export function sortBy<T extends GenericObject> (array: T[], selector: (item: T) => string, direction?: 'asc' | 'desc'): T[]
export function sortBy<T extends GenericObject, K extends keyof NumberOnly<T>> (array: T[], key: K, direction?: 'asc' | 'desc'): T[]
export function sortBy<T extends GenericObject> (array: T[], selector: keyof T | ((item: T) => number | string), direction: 'asc' | 'desc' = 'asc'): T[] {
  let getValue: (item: T) => number | string
  if (typeof selector === 'string' || typeof selector === 'number' || typeof selector === 'symbol') {
    getValue = (item: T) => item[selector] as number | string
  } else if (typeof selector === 'function') {
    getValue = selector
  } else {
    assertUnreachable(selector)
  }

  return Array.from(array).sort((a: T, b: T) => {
    const x = getValue(a)
    const y = getValue(b)

    let diff: number
    if (typeof x === 'number' && typeof y === 'number') {
      diff = x - y
    } else if (typeof x === 'string' && typeof y === 'string') {
      diff = x.localeCompare(y)
    } else {
      throw new Error('Unexpected type')
    }
    return direction === 'asc' ? diff : -diff
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

/** Merges the two arrays on the given key. Both arrays must be the same lenght and overlap exactly on the key, but no other property.
 * The merged object has the same order as the first array, relative to the keys. */
export function zipOnStrict<T extends GenericObject, U extends GenericObject, Key extends (string | number | symbol) & PrimitiveKeys<T> & PrimitiveKeys<U>> (first: T[], second: U[], key: Key): (T & U)[] {
  if (first.length !== second.length) {
    throw new Error('Cannot strict-zip arrays with different lengths')
  }

  const firstKeys = unique(first.map(x => x[key]))
  const secondKeys = unique(second.map(y => y[key]))
  if (firstKeys.length !== secondKeys.length || firstKeys.length !== first.length) {
    throw new Error('Cannot strict-zip arrays with non-unique keys')
  }

  if (firstKeys.find(x => x == null) || secondKeys.find(y => y == null)) {
    throw new Error('Cannot strict-zip arrays when at least one element is null')
  }

  // since keys are unique, and since both sets of keys should be exactly overlapping,
  // the grouped values should be the exact same set
  const groupedKeys = groupedSingle([...firstKeys, ...secondKeys], x => x)
  if (firstKeys.length !== groupedKeys.length) {
    throw new Error('Cannot strict-zip arrays with differing keys')
  }

  const result = first.map(x => ({ ...x, ...second.find(y => y[key] === x[key])! }))
  return result
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

/** Assigns items to multi-member groups. The order of a group is retained depending on when it was first encountered.
 * Items within that group are ordered depending on when they were added to the gorup. */
export function group<T, G> (arr: T[], grouper: (item: T) => G): { group: G, items: T[] }[] {
  let groupIndices: Map<G, number> = new Map()
  let nextGroupIndex = 0
  let groups: { group: G, items: T[] }[] = []

  for(const item of arr) {
    const group = grouper(item)
    if (!groupIndices.has(group)) {
      groups.push({ group, items: [item] })
      groupIndices.set(group, nextGroupIndex)
      nextGroupIndex++
    } else {
      groups[groupIndices.get(group)!].items.push(item)
    }
  }

  return groups
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

export function nonNull<T> (arr: (T | null)[]): T[] {
  return arr.filter(value => value != null) as T[]
}

export function values<T> (map: Map<any, T>): T[] {
  return kvp(map).map(pair => pair.value)
}

export function kvp<K, V> (map: Map<K, V>): { key: K, value: V }[] {
  let array: { key: K, value: V }[] = []

  const iterator = map.entries()
  let result = iterator.next()
  while (!result.done) {
    array.push({ key: result.value[0], value: result.value[1] })
    result = iterator.next()
  }

  return array
}

export function compareArrays<T> (first: T[], second: T[], comparator?: (a: T, b: T) => boolean) {
  if (first.length !== second.length) {
    return false
  }

  if (comparator == null) {
    comparator = (a: T, b: T) => a === b
  }

  for (let i = 0; i < first.length; i++) {
    if (!comparator(first[i], second[i])) {
      return false
    }
  }

  return true
}
