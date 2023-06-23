import RankHelpers from '@rebel/server/helpers/RankHelpers'
import { cast, nameof } from '@rebel/shared/testUtils'
import * as data from '@rebel/server/_test/testData'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { addTime } from '@rebel/shared/util/datetime'

let rankHelpers: RankHelpers
beforeEach(() => {
  rankHelpers = new RankHelpers()
})

describe(nameof(RankHelpers, 'isRankActive'), () => {
  const time1 = new Date()
  const time2 = addTime(time1, 'minutes', 1)
  const time3 = addTime(time1, 'minutes', 2)

  test('returns false if checking at a time before the rank was applied', () => {
    const rank = makeRank(time2, null, null)

    const result = rankHelpers.isRankActive(rank, time1)

    expect(result).toBe(false)
  })

  test('returns false if checking after the rank expired', () => {
    const rank = makeRank(time1, time2, null)

    const result = rankHelpers.isRankActive(rank, time3)

    expect(result).toBe(false)
  })

  test('returns false if checking after the rank was revoked', () => {
    const rank = makeRank(time1, null, time2)

    const result = rankHelpers.isRankActive(rank, time3)

    expect(result).toBe(false)
  })

  test('returns true if the rank is not expired or revoked', () => {
    const rank = makeRank(time1, null, null)

    const result = rankHelpers.isRankActive(rank, time2)

    expect(result).toBe(true)
  })

  test('returns true if checking before the rank expired', () => {
    const rank = makeRank(time1, time3, null)

    const result = rankHelpers.isRankActive(rank, time2)

    expect(result).toBe(true)
  })

  test('returns true if checking before the rank was revoked', () => {
    const rank = makeRank(time1, null, time3)

    const result = rankHelpers.isRankActive(rank, time2)

    expect(result).toBe(true)
  })
})

function makeRank (appliedAt: Date, expiredAt: Date | null, revokedAt: Date | null): UserRankWithRelations {
  return cast<UserRankWithRelations>({
    issuedAt: appliedAt,
    expirationTime: expiredAt,
    revokedTime: revokedAt
  })
}