// formats to YYYY-MM-dd
export function formatDate (date?: Date, utc?: boolean) {
  const dateToFormat = date ?? new Date()
  const { year, month, day } = deconstructDate(dateToFormat, utc ?? false)
  return `${year}-${num2str(month)}-${num2str(day)}`
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
    day: utc ? date.getUTCDay() : date.getDay(),
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
