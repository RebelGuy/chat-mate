import { sortBy } from '@rebel/server/util/arrays'
import { assertUnreachable } from '@rebel/server/util/typescript'

export const MAX_DATE = new Date(8640000000000000)

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

function deconstructDate (date: Date, utc: boolean) {
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
