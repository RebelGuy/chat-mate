import { sortBy } from '@rebel/shared/util/arrays'
import { assertUnreachable } from '@rebel/shared/util/typescript'

export const MAX_DATE = new Date(8640000000000000)

export const ONE_SECOND = 1000

export const ONE_MINUTE = ONE_SECOND * 60

export const ONE_HOUR = ONE_MINUTE * 60

export const ONE_DAY = ONE_HOUR * 24

export const ONE_MONTH = ONE_DAY * (365.25/12)

export const ONE_YEAR = ONE_DAY * 365.25

// formats to YYYY-MM-dd
export function formatDate (date?: Date, utc?: boolean) {
  const dateToFormat = date ?? new Date()
  const { year, month, day } = deconstructDate(dateToFormat, utc ?? false)
  return `${year}-${num2str(month, 2)}-${num2str(day, 2)}`
}

// formats to HH:mm:ss.fff
export function formatTime (date?: Date, utc?: boolean) {
  const dateToFormat = date ?? new Date()
  const { hours, minutes, seconds, milliseconds } = deconstructDate(dateToFormat, utc ?? false)
  return `${num2str(hours, 2)}:${num2str(minutes, 2)}:${num2str(seconds, 2)}.${num2str(milliseconds, 3)}`
}

export function deconstructDate (date: Date, utc: boolean) {
  return {
    year: utc ? date.getUTCFullYear() : date.getFullYear(),
    // months start at zero...
    month: utc ? date.getUTCMonth() + 1 : date.getMonth() + 1,
    day: utc ? date.getUTCDate() : date.getDate(),
    hours: utc ? date.getUTCHours() : date.getHours(),
    minutes: utc ? date.getUTCMinutes() : date.getMinutes(),
    seconds: utc ? date.getUTCSeconds() : date.getSeconds(),
    milliseconds: utc ? date.getUTCMilliseconds() : date.getMilliseconds()
  }
}

function num2str (num: number, paddedLength?: number) {
  let str = String(num)
  if (paddedLength) {
    str = str.padStart(paddedLength, '0')
  }
  return str
}

export function addTime (date: Date,  unit: 'seconds' | 'minutes' | 'hours' | 'days', amount: number) {
  let msPerUnit
  switch (unit) {
    case 'seconds':
      msPerUnit = 1_000
      break
    case 'minutes':
      msPerUnit = 60_000
      break
    case 'hours':
      msPerUnit = 3_600_000
      break
    case 'days':
      msPerUnit = 86_400_000
      break
    default:
      assertUnreachable(unit)
  }

  return new Date(date.getTime() + msPerUnit * amount)
}

export function maxTime (...times: Date[]): Date {
  let max: Date = times[0]
  for (const time of times) {
    if (time > max) {
      max = time
    }
  }
  return max
}

export function minTime (...times: Date[]): Date {
  let min: Date = times[0]
  for (const time of times) {
    if (time < min) {
      min = time
    }
  }
  return min
}

export function sortTimes (...times: Date[]): Date[] {
  return [...times].sort((a, b) => a.getTime() - b.getTime())
}

// depth: how many extra parts of lower value we should include in the string. E.g. '4 hours' for depth 0, '4 hours, 20 minutes' for depth 1
export function getElapsedText (elapsed: number, depth: number, allowMs?: boolean): string {
  if (depth < 0) {
    return ''
  }

  let unit: string
  let amount: number
  let availableDepth: number

  if (allowMs && elapsed < ONE_SECOND * 10) {
    unit = 'ms'
    amount = Math.floor(elapsed)
    elapsed = 0
    availableDepth = 0
  } else if (elapsed < ONE_MINUTE) {
    unit = 'second'
    amount = Math.floor(elapsed / 1000)
    elapsed -= 1000 * amount
    availableDepth = 1
  } else if (elapsed < ONE_HOUR) {
    unit = 'minute'
    amount = Math.floor(elapsed / ONE_MINUTE)
    elapsed -= ONE_MINUTE * amount
    availableDepth = 2
  } else if (elapsed < ONE_DAY) {
    unit = 'hour'
    amount = Math.floor(elapsed / ONE_HOUR)
    elapsed -= ONE_HOUR * amount
    availableDepth = 3
  } else if (elapsed < ONE_MONTH) {
    unit = 'day'
    amount = Math.floor(elapsed / ONE_DAY)
    elapsed -= ONE_DAY * amount
    availableDepth = 4
  } else if (elapsed < ONE_YEAR) {
    unit = 'month'
    amount = Math.floor(elapsed / ONE_MONTH)
    elapsed -= ONE_MONTH * amount
    availableDepth = 5
  } else {
    unit = 'year'
    amount = Math.floor(elapsed / ONE_YEAR)
    elapsed -= ONE_YEAR * amount
    availableDepth = 6
  }

  if (amount !== 1 && !allowMs) {
    unit += 's'
  }

  if (allowMs) {
    depth--
  }

  const text = `${amount} ${unit}`

  const reachedLimit = allowMs ? availableDepth === 0 : availableDepth === 1
  if (depth <= 0 || reachedLimit || elapsed === 0) {
    return text
  } else {
    return `${text}, ${getElapsedText(elapsed, depth - 1, allowMs)}`
  }
}

/** Returns the duration in the form HH:mm:ss */
export function getNumericElapsedHoursText (elapsed: number) {
  const hours = Math.floor(elapsed / ONE_HOUR)
  elapsed -= hours * ONE_HOUR

  const minutes = Math.floor(elapsed / ONE_MINUTE)
  elapsed -= minutes * ONE_MINUTE

  const seconds = Math.floor(elapsed / ONE_SECOND)

  return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}
