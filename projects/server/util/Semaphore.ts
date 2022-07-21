export default class Semaphore {
  private readonly maxParallel: number
  private readonly timeout: number | null

  private current: number = 0
  private queue: (() => void)[] = []

  constructor (maxParallel: number = 1, timeout: number | null = null) {
    this.maxParallel = maxParallel
    this.timeout = timeout
  }

  /** Await this. If the promise resolves, then the code has entered the semaphore and you MUST call `exit()` when done. */
  public async enter (): Promise<void> {
    if (this.current < this.maxParallel) {
      this.current++
      return

    } else {
      // hold on to the queued resolve-callback
      let cb: () => void
      const promise = new Promise<void>(resolve => {
        this.wait(resolve)
        cb = resolve
      })

      const timeout = new Promise((_, reject) => {
        if (this.timeout == null) {
          return
        }

        setTimeout(() => {
          // it is important that we clear the resolve-callback from the queue,
          // otherwise it will enter the semaphore (increment this.current) without
          // the caller knowing, and thus will never be able to exit
          this.queue = this.queue.filter(x => x === cb)
          reject(new Error('Request timed out.'))
        }, this.timeout)
      })

      return Promise.race([timeout, promise]) as Promise<void>
    }
  }

  public exit () {
    this.current--
    this.next()
  }

  private wait (cb: () => void) {
    this.queue.push(cb)
  }

  private next () {
    if (this.queue.length > 0) {
      const cb = this.queue.shift()!
      this.current++
      cb()
    }
  }
}