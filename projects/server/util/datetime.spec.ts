import { addTime, formatDate, formatTime } from '@rebel/server/util/datetime'

describe(formatDate, () => {
  test('utc date formats correctly', () => expect(formatDate(new Date(2021, 1, 2, 7, 43, 1), true)).toBe('2021-02-01'))
})

describe(formatTime, () => {
  test('utc time formats correctly', () => expect(formatTime(new Date(2021, 1, 2, 7, 43, 1, 2), true)).toBe('21:43:01.002'))
})

describe(addTime, () => {
  const t = new Date(2022, 1, 1, 12)

  test('adding zero seconds returns same time', () => expect(addTime(t, 'seconds', 0)).toEqual(t))
  test('adding positive seconds works', () => expect(addTime(t, 'seconds', 1)).toEqual(new Date(2022, 1, 1, 12, 0, 1)))
  test('adding negative seconds works', () => expect(addTime(t, 'seconds',-1)).toEqual(new Date(2022, 1, 1, 11, 59, 59)))
})
