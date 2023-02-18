import { URL } from 'node:url'

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
    throw new Error(`A video/livestream ID (${id}) was able to be found on the link ${linkOrId}, but it was malformed.`)
  } else {
    return id
  }
}

export function getLivestreamLink (liveId: string) {
  return `https://youtu.be/${liveId}`
}

// converts a camelCase or PascalCase word to CONSTANT_CASE.
// short sequential characters like 'ID' are treated as a single part of the word.
export function toConstCase (word: string): string {
  word = word.trim()
  if (word.includes(' ')) {
    throw new Error('Input has to be a single word')
  } else if (isConstCase(word)) {
    return word
  } else if (word.includes('_')) {
    return word.split('_').map(w => toConstCase(w)).join('_')
  }

  let lastCapital = 0
  let underscores: number[] = []
  for (let i = 1; i < word.length; i++) {
    const char = word[i]!
    // this excludes things like numbers
    const isCapital = char !== char.toLowerCase() && char === char.toUpperCase()

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

function isConstCase (word: string): boolean {
  return word.toUpperCase() === word
}

// converts the words to param_case
export function toParamCase (text: string): string {
  return text
    .replace(/[-.,]/, ' ')
    .split(' ')
    .map(t => toConstCase(t))
    .join('_')
    .toLowerCase()
}

// converts the word to cascalCase
export function toCamelCase (word: string): string {
  return toConstCase(word)
    .split('_')
    .map(part => part.toLowerCase())
    .map((part, i) => i === 0 ? part : capitaliseWord(part))
    .join('')
}

export function capitaliseWord (word: string): string {
  return word.substring(0, 1).toUpperCase() + word.substring(1)
}

export function ensureMaxTextWidth (text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength) : text
}
