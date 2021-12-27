import { formatDate, formatTime } from '@rebel/server/util/datetime'

describe(formatDate, () => {
  test('local date formats correctly', () => expect(formatDate(new Date(2021, 1, 2, 7, 43, 1), false)).toBe("2021-02-02"))
  test('utc date formats correctly', () => expect(formatDate(new Date(2021, 1, 2, 7, 43, 1), true)).toBe("2021-02-01"))
})

describe(formatTime, () => {
  test('local time formats correctly', () => expect(formatTime(new Date(2021, 1, 2, 7, 43, 1, 2), false)).toBe("07:43:01.002"))
  test('utc time formats correctly', () => expect(formatTime(new Date(2021, 1, 2, 7, 43, 1, 2), true)).toBe("21:43:01.002"))
})
