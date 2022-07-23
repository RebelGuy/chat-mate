export class TimeoutError extends Error {
  public readonly timeout?: number

  constructor (message?: string, timeout?: number) {
    super(message)

    Object.setPrototypeOf(this, TimeoutError.prototype)

    this.timeout = timeout
  }
}
