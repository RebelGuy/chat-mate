import { ChatMateError, TimeoutError } from '@rebel/shared/util/error'

export default class Semaphore {
  private readonly maxParallel: number
  private readonly timeout: number | null

  private current: number = 0
  private queue: (() => void)[] = []

  constructor (maxParallel: number = 1, timeout: number | null = null) {
    this.maxParallel = maxParallel
    this.timeout = timeout
  }

  /**
   * If the promise resolves, then the code has entered the semaphore and you MUST call `exit()` when done.
   *
   * @throws {@link TimeoutError}: When the waiting time exceeds the timeout for this semaphore (if set).
   */
  public async enter (): Promise<void> {
    if (this.current < this.maxParallel) {
      this.current++
      return

    } else {
      let cb: () => void
      const enterPromise = new Promise<void>(resolve => {
        cb = resolve
        this.wait(resolve)
      })

      let timer: NodeJS.Timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        if (this.timeout == null) {
          return
        }

        timer = setTimeout(() => {
          // make sure we remove the resolve-callback from the queue, because `exit()` would never be called
          // and we would be stuck in a deadlock.
          this.queue = this.queue.filter(x => x !== cb)
          reject(new TimeoutError('Request timed out.', this.timeout!))
        }, this.timeout)
      })

      await Promise.race([enterPromise, timeoutPromise])

      // just because the enterPromise resolves doesn't stop the timeout from firing
      clearTimeout(timer!)
    }
  }

  public exit () {
    this.current--
    this.next()
  }

  public getCurrent () {
    return this.current
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

/** Keeps track of one semaphore per group, ensuring that unused semaphores are cleaned up. */
export class GroupedSemaphore<TGroup> {
  private readonly maxParallel: number
  private readonly timeout: number | null
  private readonly semaphores: Map<TGroup, Semaphore>

  constructor (maxParallel: number = 1, timeout: number | null = null) {
    this.maxParallel = maxParallel
    this.timeout = timeout
    this.semaphores = new Map()
  }

  /**
   * If the promise resolves, then the code has entered the semaphore and you MUST call `exit()` when done.
   *
   * @throws {@link TimeoutError}: When the waiting time exceeds the timeout for this semaphore (if set).
   */
  public async enter (group: TGroup): Promise<void> {
    if (!this.semaphores.has(group)) {
      this.semaphores.set(group, new Semaphore(this.maxParallel, this.timeout))
    }

    await this.semaphores.get(group)!.enter()
  }

  public exit (group: TGroup) {
    const semaphore = this.semaphores.get(group)
    if (semaphore == null) {
      throw new ChatMateError(`Semaphore for group ${group} is not defined`)
    }

    semaphore.exit()

    if (semaphore.getCurrent() === 0) {
      this.semaphores.delete(group)
    }
  }
}
