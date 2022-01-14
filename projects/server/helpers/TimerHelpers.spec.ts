import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import { nameof, promised } from '@rebel/server/_test/utils'

let timeoutSpy: jest.SpyInstance
let timerHelpers: TimerHelpers

beforeEach(() => {
  // don't use `legacy` mode since we are not dealing with setInterval.
  jest.useFakeTimers()
  timeoutSpy = jest.spyOn(global, 'setTimeout')

  timerHelpers = new TimerHelpers()
})

afterEach(() => {
  jest.useRealTimers()
  timeoutSpy.mockReset()
})

describe(nameof(TimerHelpers, 'createRepeatingTimer'), () => {
  test('fixed timer is rescheduled after callback', () => {
    const interval = 300
    let calls = 0
    const options: TimerOptions = {
      behaviour: 'start',
      callback: () => { calls++; return new Promise(r => r()) },
      interval
    }

    timerHelpers.createRepeatingTimer(options)

    jest.runOnlyPendingTimers()
    expect(calls).toBe(1) // first
    jest.runOnlyPendingTimers()
    expect(calls).toBe(2) // second

    // initial, after first, after second
    expect(timeoutSpy.mock.calls.map(c => c[1] as number)).toEqual([300, 300, 300])
  })

  test('dynamic timer uses correct timeout when rescheduling', async () => {
    let calls = 0
    const options: TimerOptions = {
      behaviour: 'dynamicEnd',
      callback: () => { calls++; return promised(300) }
    }

    await timerHelpers.createRepeatingTimer(options, true)

    expect(calls).toBe(1) // initial call
    jest.runOnlyPendingTimers()
    expect(calls).toBe(2) // first call

    expect(timeoutSpy.mock.calls.map(c => c[1] as number)).toEqual([0, 300])
  })

  test(`dynamic timer throws if callback doesn't return number`, async () => {
    const options: TimerOptions = {
      behaviour: 'dynamicEnd',
      callback: () => new Promise<void>(r => r()) as any
    }

    await expect(() => timerHelpers.createRepeatingTimer(options, true)).rejects.toThrow()
  })
})

describe(nameof(TimerHelpers, 'dispose'), () => {
  test('all timers are stopped', () => {
    const options: TimerOptions = {
      behaviour: 'end',
      callback: () => new Promise(r => r()),
      interval: 300
    }

    timerHelpers.createRepeatingTimer(options)
    timerHelpers.createRepeatingTimer(options)

    expect(jest.getTimerCount()).toBe(2)

    timerHelpers.dispose()

    expect(jest.getTimerCount()).toBe(0)
  })
})
