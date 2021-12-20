import { List, isList } from 'immutable'

export function clamp (min: number, value: number, max: number) {
  return value < min ? min : value > max ? max : value
}

export function sum (numbers: number[] | List<number>) {
  if (isList(numbers)) {
    numbers = numbers.toArray()
  }

  return numbers.reduce((s, x) => s + x, 0)
}

// clamps and normalises the function across the given domain, i.e. return a value between 0 and 1 scaled according to the values at the domain boundaries.
// note that function values will be clipped by the rect [minX, fn(minX)], [maxX, fn(maxX)], so monotonic functions are preferred.
export function clampNormFn (fn: (x: number) => number, minX: number, maxX: number): (x: number) => number {
  const minY = fn(minX)
  const maxY = fn(maxX)

  return (x: number) => {
    if (maxY === minY) {
      // special case to avoid dividing by zero
      return 0.5
    }

    let y: number
    if (x < minX) {
      y = minY
    } else if (x > maxX) {
      y = maxY
    } else {
      y = fn(x)
    }

    const normY = (y - minY) / (maxY - minY)
    return normY
  }
}
