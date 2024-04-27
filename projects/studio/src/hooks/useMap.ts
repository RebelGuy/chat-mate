import { useRef, useState } from 'react'

export default function useMap<K, V> () {
  const [updateCounter, setUpdateCounter] = useState(0)
  const map = useRef<Map<K, V>>(new Map())

  const size = map.current.size

  function get (key: K) {
    return map.current.get(key)
  }

  function set (key: K, value: V) {
    setUpdateCounter(updateCounter + 1)
    return map.current.set(key, value)
  }

  function remove (key: K) {
    setUpdateCounter(updateCounter + 1)
    return map.current.delete(key)
  }

  function has (key: K) {
    return map.current.has(key)
  }

  function clear (predicate?: (key: K, value: V) => boolean) {
    setUpdateCounter(updateCounter + 1)

    if (predicate == null) {
      map.current.clear()
    } else {
      let keysToRemove: K[] = []
      map.current.forEach((v, k) => predicate(k, v) ? keysToRemove.push(k) : undefined)
      keysToRemove.forEach(k => map.current.delete(k))
    }
  }

  function replaceKeys (keyReplacer: (oldKey: K) => K) {
    setUpdateCounter(updateCounter + 1)

    const keys = map.current.keys()
    for (const key of keys) {
      const newKey = keyReplacer(key)
      if (key === newKey) {
        continue
      }

      const value = map.current.get(key)!
      map.current.delete(key)
      map.current.set(newKey, value)
    }
  }

  function toRecord (keyTransformer: (key: K) => string | number | symbol) {
    let result: Record<string | number | symbol, V> = {}
    map.current.forEach((v, k) => result[keyTransformer != null ? keyTransformer(k) : k as string | number | symbol] = v)
    return result
  }

  return { size, get, set, delete: remove, has, clear, toRecord, replaceKeys }
}
