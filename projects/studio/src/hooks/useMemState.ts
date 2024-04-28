import { useState } from 'react'

export default function useMemState<T> (initialCurrent: T, initialPrev: T): [current: T, prev: T, setNew: (newValue: T) => void, setAll: (value: T) => void] {
  const [values, setValues] = useState<[T, T]>([initialCurrent, initialPrev])
  const [current, prev] = values

  function setNew (newValue: T) {
    setValues([newValue, current])
  }

  function setAll (value: T) {
    setValues([value, value])
  }

  return [values[0], values[1], setNew, setAll]
}
