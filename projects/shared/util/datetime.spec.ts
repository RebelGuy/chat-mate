import { addTime, formatDate, formatTime, getNumericElapsedHoursText } from '@rebel/shared/util/datetime'

describe(addTime, () => {
  const t = new Date(2022, 1, 1, 12)

  test('adding zero seconds returns same time', () => expect(addTime(t, 'seconds', 0)).toEqual(t))
  test('adding positive seconds works', () => expect(addTime(t, 'seconds', 1)).toEqual(new Date(2022, 1, 1, 12, 0, 1)))
  test('adding negative seconds works', () => expect(addTime(t, 'seconds',-1)).toEqual(new Date(2022, 1, 1, 11, 59, 59)))
})

describe(getNumericElapsedHoursText, () => {
  test('Zero seconds', () => expect(getNumericElapsedHoursText(1)).toBe('00:00:00'))
  test('One second', () => expect(getNumericElapsedHoursText(1900)).toBe('00:00:01'))
  test('Fifty-nine seconds', () => expect(getNumericElapsedHoursText(60_000 - 1)).toBe('00:00:59'))
  test('One minute', () => expect(getNumericElapsedHoursText(60_000)).toBe('00:01:00'))
  test('Ten minutes', () => expect(getNumericElapsedHoursText(60_000 * 10)).toBe('00:10:00'))
  test('One hour', () => expect(getNumericElapsedHoursText(3600_000)).toBe('01:00:00'))
  test('Ten hours', () => expect(getNumericElapsedHoursText(3600_000 * 10)).toBe('10:00:00'))
  test('Hundred hours', () => expect(getNumericElapsedHoursText(3600_000 * 100)).toBe('100:00:00'))
  test('Compound', () => expect(getNumericElapsedHoursText(3600_000 * 4 + 60_000 * 32 + 1_000 * 9 + 965)).toBe('04:32:09'))
})
