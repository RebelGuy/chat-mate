import { isList, List } from 'immutable';
import { URL } from 'node:url';
import { ConditionalExpression } from 'typescript';

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

  let id: string | null = null
  let url: URL
  try {
    url = new URL(linkOrId)
  } catch (e: any) {
    throw new Error(`The provided link is ${linkOrId} is malformed: ${e.message}`)
  }

  if (linkOrId.includes('watch?v=') && linkOrId.includes('youtu')) {
    id = url.searchParams.get('v')

  } else if (linkOrId.includes('studio.youtube.com')) {
    const path = url.pathname.split('/').filter(p => p.length > 0)
    id = path[1]

  } else if (linkOrId.includes('youtu')) {
    const path = url.pathname.split('/').filter(p => p.length > 0)

    // direct link (e.g. https://youtu.be/VTriRgpNd-s)
    if (path.length === 1) {
      id = path[0]
    }
  } else {
    throw new Error(`The provided link ${linkOrId} is malformed.`)
  }

  if (id == null || id.length === 0) {
    throw new Error(`The provided link ${linkOrId} does not contain a video ID.`)
  } else if (id.length !== ID_LENGTH) {
    throw new Error(`A video/livestream ID (${id}) was able to be found on the link ${linkOrId}, but it wasn malformed.`)
  } else {
    console.log(`Using live ID ${id}`)
    return id
  }
}

export function assert(condition: any, msg: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

// converts a camelCase or PascalCase word to CONSTANT_CASE.
// short sequential characters like 'ID' are treated as a single part of the word. 
export function toConstCase (word: string): string {
  let lastCapital = 0
  let underscores: number[] = []
  for (let i = 1; i < word.length; i++) {
    const char = word[i]!
    const isCapital = char === char.toUpperCase()

    if (isCapital && i - lastCapital > 1) {
      lastCapital = i
      underscores.push(i)
    }
  }

  let constName = word as string
  for (let i = underscores.length - 1; i >= 0; i--) {
    const pos = underscores[i]!
    constName = constName.substring(0, pos ) + '_' + constName.substring(pos)
  }

  return constName.toUpperCase()
}

// blocks the thread
export function sleepSync(ms: number) {
  const start = Date.now()
  while (Date.now() < start + 1000) {}
}

// formats to YYYY-MM-dd
export function formatDate(date?: Date, utc?: boolean) {
  const dateToFormat = date ?? new Date()

  const year = utc ? String(dateToFormat.getUTCFullYear()) : String(dateToFormat.getFullYear())
  // months start at zero...
  const month = utc ? String(dateToFormat.getUTCMonth() + 1) : String(dateToFormat.getMonth() + 1)
  const day = utc ? String(dateToFormat.getUTCDate()) : String(dateToFormat.getDate())
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}
