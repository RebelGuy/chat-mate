import { Dependencies } from '@rebel/shared/context/context'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import YoutubeTimeoutRefreshService, { YOUTUBE_TIMEOUT_DURATION } from '@rebel/server/services/YoutubeTimeoutRefreshService'
import { addTime } from '@rebel/shared/util/datetime'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'

type DynamicTimerOptions = Extract<TimerOptions, { behaviour: 'dynamicEnd' }>

type CreateTimerArgs = [DynamicTimerOptions, boolean]

const now = new Date()
const punishmentId = 5
const timerId = 2
let refreshCount = 0
// eslint-disable-next-line @typescript-eslint/require-await
const onRefresh = async () => { refreshCount++ }

let mockTimerHelpers: MockProxy<TimerHelpers>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let youtubeTimeoutRefreshService: YoutubeTimeoutRefreshService

beforeEach(() => {
  mockTimerHelpers = mock()
  mockTimerHelpers.createRepeatingTimer.calledWith(expect.anything(), expect.anything()).mockReturnValue(timerId)

  mockDateTimeHelpers = mock()
  mockDateTimeHelpers.ts.mockImplementation(() => new Date().getTime())

  youtubeTimeoutRefreshService = new YoutubeTimeoutRefreshService(new Dependencies({
    timerHelpers: mockTimerHelpers,
    dateTimeHelpers: mockDateTimeHelpers
  }))

  refreshCount = 0
})

describe(nameof(YoutubeTimeoutRefreshService, 'startTrackingTimeout'), () => {
  test('[on initilisation] skips refresh if difference is less than 5 minutes', async () => {
    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(now, 'minutes', 1), true, onRefresh)

    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(0)
  })

  test('[on initialisation] refreshes immediately and creates single-use timer if difference is between 5 and 10 minutes', async () => {
    mockDateTimeHelpers.ts.mockReset()
    mockDateTimeHelpers.ts.calledWith().mockReturnValueOnce(now.getTime())
    mockDateTimeHelpers.ts.calledWith().mockReturnValueOnce(addTime(now, 'minutes', 1).getTime())

    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(now, 'minutes', 6), true, onRefresh)
    expect(refreshCount).toBe(1)

    const [options, runImmediately] = single(mockTimerHelpers.createRepeatingTimer.mock.calls) as CreateTimerArgs
    expect(runImmediately).toBe(true)
    expect(options.initialInterval).toBe(60_000)

    await options.callback()
    expect(refreshCount).toBe(2)
  })

  test('[on initialisation] refreshes immediately and creates multi-use timer if difference is greater than 10 minutes', async () => {
    mockDateTimeHelpers.ts.mockReset()
    mockDateTimeHelpers.ts.calledWith()
      .mockReturnValueOnce(now.getTime())
      .mockReturnValueOnce(addTime(now, 'minutes', 5).getTime())
      .mockReturnValueOnce(addTime(now, 'minutes', 6).getTime())

    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(now, 'minutes', 11), true, onRefresh)

    const [options, runImmediately] = single(mockTimerHelpers.createRepeatingTimer.mock.calls) as CreateTimerArgs
    expect(runImmediately).toBe(true)
    expect(options.initialInterval).toBe(300_000)
    expect(refreshCount).toBe(1)

    const nextInterval = await options.callback()
    expect(nextInterval).toBe(60_000)
    expect(refreshCount).toBe(2)

    await options.callback()
    expect(refreshCount).toBe(3)

    const disposedArgs = single(mockTimerHelpers.disposeSingle.mock.calls)
    expect(disposedArgs).toEqual([timerId])
  })

  test('[during runtime] skips refresh if difference is 5 minutes', async () => {
    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(now, 'minutes', 5), false, onRefresh)

    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(0)
  })

  test('[during runtime] creates single-use timer if difference is between 5 and 10 minutes', async () => {
    mockDateTimeHelpers.ts.mockReset()
    mockDateTimeHelpers.ts.calledWith()
      .mockReturnValueOnce(now.getTime())
      .mockReturnValueOnce(addTime(now, 'minutes', 1).getTime())

    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(now, 'minutes', 6), false, onRefresh)
    expect(refreshCount).toBe(0)

    const [options, runImmediately] = single(mockTimerHelpers.createRepeatingTimer.mock.calls) as CreateTimerArgs
    expect(runImmediately).toBe(false)
    expect(options.initialInterval).toBe(60_000)

    await options.callback()
    expect(refreshCount).toBe(1)
  })

  test('[during runtime] creates multi-use timer if difference is greater than 10 minutes', async () => {
    mockDateTimeHelpers.ts.mockReset()
    mockDateTimeHelpers.ts.calledWith()
      .mockReturnValueOnce(now.getTime())
      .mockReturnValueOnce(addTime(now, 'minutes', 5).getTime())
      .mockReturnValueOnce(addTime(now, 'minutes', 6).getTime())

    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(now, 'minutes', 11), false, onRefresh)

    const [options, runImmediately] = single(mockTimerHelpers.createRepeatingTimer.mock.calls) as CreateTimerArgs
    expect(runImmediately).toBe(false)
    expect(options.initialInterval).toBe(300_000)
    expect(refreshCount).toBe(0)

    const nextInterval = await options.callback()
    expect(nextInterval).toBe(60_000)
    expect(refreshCount).toBe(1)

    await options.callback()
    expect(refreshCount).toBe(2)

    const disposedArgs = single(mockTimerHelpers.disposeSingle.mock.calls)
    expect(disposedArgs).toEqual([timerId])
  })
})

describe(nameof(YoutubeTimeoutRefreshService, 'stopTrackingTimeout'), () => {
  test('removes timer', async () => {
    await youtubeTimeoutRefreshService.startTrackingTimeout(punishmentId, addTime(now, 'hours', 1), false, onRefresh)

    youtubeTimeoutRefreshService.stopTrackingTimeout(punishmentId)

    const disposeSingleArgs = single(mockTimerHelpers.disposeSingle.mock.calls)
    expect(disposeSingleArgs).toEqual([timerId])
  })

  test(`does nothing if timer doesn't exist`, () => {
    youtubeTimeoutRefreshService.stopTrackingTimeout(punishmentId)

    expect(mockTimerHelpers.disposeSingle.mock.calls.length).toBe(0)
  })
})
