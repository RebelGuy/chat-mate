import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import { nameof, promised } from '@rebel/shared/testUtils'
import { ChatMateError } from '@rebel/shared/util/error'

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

describe(nameof(TimerHelpers, 'setTimeout'), () => {
  test('Calls the callback after the specified delay', () => {
    let calls = 0
    const cb = () => { calls++ }

    timerHelpers.setTimeout(cb, 1000)

    jest.advanceTimersByTime(999)
    expect(calls).toBe(0)

    jest.advanceTimersByTime(1)
    expect(calls).toBe(1)
  })

  test('Does not call the callback if the timeout was cancelled', () => {
    let calls = 0
    const cb = () => { calls++ }

    const clearTimeout = timerHelpers.setTimeout(cb, 1000)

    jest.advanceTimersByTime(999)
    expect(calls).toBe(0)

    clearTimeout()

    jest.advanceTimersByTime(1)
    expect(calls).toBe(0)
  })
})

describe(nameof(TimerHelpers, 'setInterval'), () => {
  test('Calls the callback multiple times after the specified interval', () => {
    let calls = 0
    const cb = () => { calls++ }

    timerHelpers.setInterval(cb, 1000)

    jest.advanceTimersByTime(999)
    expect(calls).toBe(0)

    jest.advanceTimersByTime(1)
    expect(calls).toBe(1)

    jest.advanceTimersByTime(1000)
    expect(calls).toBe(2)
  })

  test('Does not call the callback if the interval was cancelled', () => {
    let calls = 0
    const cb = () => { calls++ }

    const clearInterval = timerHelpers.setInterval(cb, 1000)

    jest.advanceTimersByTime(999)
    expect(calls).toBe(0)

    clearInterval()

    jest.advanceTimersByTime(1)
    expect(calls).toBe(0)
  })
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

    await expect(() => timerHelpers.createRepeatingTimer(options, true)).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(TimerHelpers, 'disposeSingle'), () => {
  test('does nothing if timer does not exist', () => {
    const result = timerHelpers.disposeSingle(0)

    expect(result).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('stops the identified timer', () => {
    const interval = 300
    let calls = 0
    const options: TimerOptions = {
      behaviour: 'start',
      callback: () => { calls++; return new Promise(r => r()) },
      interval
    }

    const id = timerHelpers.createRepeatingTimer(options)
    jest.runOnlyPendingTimers()

    const result = timerHelpers.disposeSingle(id)

    expect(calls).toBe(1) // first
    expect(result).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
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
