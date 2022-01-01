import { assertUnreachable } from '@rebel/server/util/typescript'

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
