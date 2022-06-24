import { addTime, formatDate, formatTime } from '@rebel/server/util/datetime'

describe(addTime, () => {
  const t = new Date(2022, 1, 1, 12)

  test('adding zero seconds returns same time', () => expect(addTime(t, 'seconds', 0)).toEqual(t))
  test('adding positive seconds works', () => expect(addTime(t, 'seconds', 1)).toEqual(new Date(2022, 1, 1, 12, 0, 1)))
  test('adding negative seconds works', () => expect(addTime(t, 'seconds',-1)).toEqual(new Date(2022, 1, 1, 11, 59, 59)))
})
