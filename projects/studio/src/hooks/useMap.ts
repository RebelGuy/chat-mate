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

  function clear () {
    setUpdateCounter(updateCounter + 1)
    return map.current.clear()
  }

  return { size, get, set, delete: remove, has, clear }
}
