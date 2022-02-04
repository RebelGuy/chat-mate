export default class Semaphore {
  private current: number = 0
  private queue: (() => void)[] = []

  public async enter (): Promise<void> {
    if (this.current === 0) {
      this.current++
      return
    } else {
      return new Promise(r => this.wait(r))
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