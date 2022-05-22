import { Dependencies } from '@rebel/server/context/context'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import YoutubeTimeoutRefreshService, { BUFFER, calculateNextInterval, YOUTUBE_TIMEOUT_DURATION } from '@rebel/server/services/YoutubeTimeoutRefreshService'
import { addTime } from '@rebel/server/util/datetime'
import { nameof, single } from '@rebel/server/_test/utils'
import { mock, MockProxy, notNull } from 'jest-mock-extended'

let mockTimerHelpers: MockProxy<TimerHelpers>
let youtubeTimeoutRefreshService: YoutubeTimeoutRefreshService

beforeEach(() => {
  mockTimerHelpers = mock()
  
  youtubeTimeoutRefreshService = new YoutubeTimeoutRefreshService(new Dependencies({
    timerHelpers: mockTimerHelpers
  }))
})

describe(nameof(YoutubeTimeoutRefreshService, 'startTrackingTimeout'), () => {
  test('creates deferred repeating timer when startImmediately is false', async () => {
    const punishmentId = 5
    const onRefresh = () => Promise.reject('Timeout should not have refreshed')
    const timerId = 2
    mockTimerHelpers.createRepeatingTimer.mockReturnValue(timerId)

    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(new Date(), 'hours', 1), false, onRefresh)

    const createTimerArgs: [options: TimerOptions, runImmediately?: false | undefined] = single(mockTimerHelpers.createRepeatingTimer.mock.calls)
    expect(createTimerArgs[0]).toEqual(expect.objectContaining<Partial<TimerOptions>>({ behaviour: 'dynamicEnd', initialInterval: YOUTUBE_TIMEOUT_DURATION - BUFFER }))
    expect(createTimerArgs[1]).toEqual(false)
  })
})

describe(nameof(YoutubeTimeoutRefreshService, 'stopTrackingTimeout'), () => {
  test('removes timer', async () => {
    const punishmentId = 5
    const onRefresh = () => Promise.reject('Timeout should not have refreshed')
    const timerId = 2
    mockTimerHelpers.createRepeatingTimer.mockReturnValue(timerId)
    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(new Date(), 'hours', 1), false, onRefresh)

    youtubeTimeoutRefreshService.stopTrackingTimeout(punishmentId)

    const disposeSingleArgs = single(mockTimerHelpers.disposeSingle.mock.calls)
    expect(disposeSingleArgs).toEqual([timerId])
  })
})

describe(nameof(calculateNextInterval), () => {
  test('returns maximum interval if expiration date is far in the future', () => {
    const expiration = addTime(new Date(), 'minutes', 20)

    const result = calculateNextInterval(expiration)

    expect(result).toBe(YOUTUBE_TIMEOUT_DURATION - BUFFER)
  })

  test('returns a small interval if expiration date is between 1 and 2 youtube-periods in the future', () => {
    const expiration = addTime(new Date(), 'minutes', 7)

    const result = calculateNextInterval(expiration)

    expect(result).toBeLessThan(YOUTUBE_TIMEOUT_DURATION - BUFFER)
  })

  test('returns null if expiration date is less than 1 youtube-period in the future', () => {
    const expiration = addTime(new Date(), 'minutes', 1)

    const result = calculateNextInterval(expiration)

    expect(result).toBeNull()
  })
})
