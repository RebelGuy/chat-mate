import DonationHelpers, { DonationAmount } from '@rebel/server/helpers/DonationHelpers'
import { nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/shared/util/datetime'

let donationHelpers: DonationHelpers

beforeEach(() => {
  donationHelpers = new DonationHelpers()
})

describe(nameof(DonationHelpers, 'isEligibleForDonator'), () => {
  const donations: DonationAmount[] = [[data.time1, 1]]

  test('Returns true if the user has donated within the last epoch', () => {
    const time = addTime(data.time1, 'days', 1)

    const result = donationHelpers.isEligibleForDonator(donations, time)

    expect(result).toBe(true)
  })

  test('Returns false if the user has not donated within the last epoch', () => {
    const time = addTime(data.time1, 'days', 600)

    const result = donationHelpers.isEligibleForDonator(donations, time)

    expect(result).toBe(false)
  })
})

describe(nameof(DonationHelpers, 'isEligibleForSupporter'), () => {
  const time1 = data.time1
  const time2 = addTime(time1, 'days', 150)
  const donations: DonationAmount[] = [
    [time1, 30],
    [time2, 30],
  ]

  test('Returns true if the user has donated at least $50 within the last epoch', () => {
    const time = addTime(time2, 'days', 1)

    const result = donationHelpers.isEligibleForSupporter(donations, time)

    expect(result).toBe(true)
  })

  test('Returns false if the user has not donated at least $50 within the last epoch', () => {
    const time = addTime(time2, 'days', 200)

    const result = donationHelpers.isEligibleForSupporter(donations, time)

    expect(result).toBe(false)
  })
})

describe(nameof(DonationHelpers, 'isEligibleForMember'), () => {
  const time1 = data.time1
  const time2 = addTime(time1, 'days', 25)
  const time3 = addTime(time2, 'days', 25)
  const time4 = addTime(time3, 'days', 25)


  test('Returns true if the user has donated for at least 3 months, within the last month', () => {
    const donations: DonationAmount[] = [[time1, 1], [time2, 1], [time3, 1], [time4, 1]]
    const time = addTime(time4, 'days', 20)

    const result = donationHelpers.isEligibleForMember(donations, time)

    expect(result).toBe(false)
  })

  test('Returns false if the user has donated for at least 3 months, but not within the last month', () => {
    const donations: DonationAmount[] = [[time1, 1], [time2, 1], [time3, 1], [time4, 1]]
    const time = addTime(time4, 'days', 40)

    const result = donationHelpers.isEligibleForMember(donations, time)

    expect(result).toBe(false)
  })

  test('Returns false if the user donations have gaps of longer than 1 month', () => {
    const donations: DonationAmount[] = [[addTime(time1, 'days', -20), 1], [time2, 1], [time3, 1], [time4, 1]]
    const time = addTime(time4, 'days', 20)

    const result = donationHelpers.isEligibleForMember(donations, time)

    expect(result).toBe(false)
  })
})
