import { isList, List } from 'immutable';
import { URL } from 'node:url';

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

// extracts the video/livestream ID from the given string
export function getLiveId (linkOrId: string): string {
  const ID_LENGTH = 11

  if (linkOrId == null || linkOrId.trim().length === 0) {
    throw new Error('A link or ID must be provided.')
  }

  linkOrId = linkOrId.trim()

  if (linkOrId.length === ID_LENGTH) {
    // provided string is a video ID
    return linkOrId
  }

  if (linkOrId.includes('watch?v=') && linkOrId.includes('youtu')) {
    const url = new URL(linkOrId)
    const id = url.searchParams.get('v')

    if (id == null || id.length === 0) {
      throw new Error(`The provided link ${linkOrId} does not contain a video ID.`)
    } else if (id.length !== ID_LENGTH) {
      throw new Error(`A video/livestream ID was able to be found on the link ${linkOrId}, but it wasn malformed.`)
    } else {
      return id
    }

  } else {
    throw new Error(`The provided link ${linkOrId} is malformed.`)
  }
}
