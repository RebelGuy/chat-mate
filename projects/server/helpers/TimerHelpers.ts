// at what point in the callback cycle the timer should be rescheduled.
// use `start` for a constant period.
// use `end` for constant padding between callbacks.

import ContextClass from '@rebel/shared/context/ContextClass'

// use `dynamicEnd` for variable padding between callbacks.
export type RescheduleBehaviour = 'start' | 'end' | 'dynamicEnd'

/** WARNING: DO NOT pass class methods directly as the callback function, as `this` will change context. */
export type TimerOptions = {
  behaviour: Extract<RescheduleBehaviour, 'start' | 'end'>,
  interval: number
  callback: () => Promise<void>
} | {
  behaviour: Extract<RescheduleBehaviour, 'dynamicEnd'>,
  // returns the time (in milliseconds) for the next timeout
  callback: () => Promise<number>,
  // if not specified, will run immediately regardless of setting
  initialInterval?: number
}

export default class TimerHelpers extends ContextClass {
  // automatically release timers that have been disposed
  private timers: Map<number, Timer>
  private _id: number = 0

  constructor () {
    super()
    this.timers = new Map()
  }

  /** Returns a function that, when invoked, will cancel the timeout. */
  public setTimeout (callback: () => Promise<any> | any, ms?: number): () => void {
    const id = setTimeout(() => callback(), ms)
    return () => clearTimeout(id)
  }

  /**
   * Create a new timer. The caller is responsible for catching errors in the `callback`.
   *
   * Note: `runImmediately` is overridden to `true` if no `initialInterval` is given for a `dynamic` timer.
   */
  public async createRepeatingTimer (options: TimerOptions, runImmediately: true): Promise<number>
  public createRepeatingTimer (options: TimerOptions, runImmediately?: false): number
  public createRepeatingTimer (options: TimerOptions, runImmediately?: boolean): Promise<number> | number {
    const timer = new Timer(options)
    const id = this._id++
    this.timers.set(id, timer)

    if (runImmediately) {
      // we can't make the function implementation async without making all overloads async as well,
      // so we have to add this little hack :)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        try {
          await timer.next()
          resolve(id)
        } catch (e) {
          // there would probably be unexpected behaviour if we don't rethrow errors like this, so
          // let's just do it to be safe.
          reject(e)
        }
      })
    } else {
      return id
    }
  }

  public disposeSingle (timerId: number): boolean {
    if (this.timers.has(timerId)) {
      this.timers.get(timerId)!.dispose()
      return true
    }
    return false
  }

  public override dispose () {
    this.timers.forEach(t => { t.dispose() })
  }
}

class Timer {
  // internally we use only setTimeout because setInterval has many quirks when testing
  private timerObject: NodeJS.Timer | null
  private disposed: boolean
  private readonly callback: () => Promise<void | number>

  private interval: number
  readonly behaviour: RescheduleBehaviour

  constructor (options: TimerOptions) {
    if (options.behaviour === 'dynamicEnd') {
      this.interval = options.initialInterval ?? 0
    } else {
      this.interval = options.interval
    }
    this.behaviour = options.behaviour
    this.callback = options.callback
    this.timerObject = null
    this.disposed = false

    this.startTimer(this.interval)
  }

  public isRunning () {
    if (this.disposed) {
      return false
    } else {
      return this.timerObject != null
    }
  }

  public async next () {
    this.stopTimer()
    if (this.disposed) {
      return
    }

    if (this.behaviour === 'start') {
      this.startTimer(this.interval)
    }

    const result = await this.callback()
    if (this.disposed) {
      this.stopTimer()
      return
    }

    if (this.behaviour === 'end') {
      this.startTimer(this.interval)
    } else if (this.behaviour === 'dynamicEnd') {
      if (typeof result !== 'number') {
        throw new Error('Callback functions for dynamic timers must return a number')
      }
      this.startTimer(result)
    }
  }

  public dispose () {
    this.disposed = true
    this.stopTimer()
  }

  private startTimer (interval: number) {
    // must pass in the anonymous function so `this` refers to the class instance.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.timerObject = setTimeout(() => this.next(), interval)
  }

  private stopTimer () {
    if (this.timerObject) {
      clearTimeout(this.timerObject)
      this.timerObject = null
    }
  }
}
