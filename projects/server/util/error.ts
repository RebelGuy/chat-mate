export class TimeoutError extends Error {
  public readonly timeout?: number

  constructor (message?: string, timeout?: number) {
    super(message)

    Object.setPrototypeOf(this, TimeoutError.prototype)

    this.timeout = timeout
  }
}

export class UserRankNotFoundError extends Error {
  constructor (message?: string){ 
    super(message)

    Object.setPrototypeOf(this, UserRankNotFoundError.prototype)
  }
}

export class UserRankAlreadyExistsError extends Error {
  constructor (message?: string){ 
    super(message)

    Object.setPrototypeOf(this, UserRankAlreadyExistsError.prototype)
  }
}

/** Intended to be used in .catch(). */
export function ignoreError (predicate: (e: any) => boolean) {
  return (e: any) => {
    if (predicate(e)) {
      return
    } else {
      throw e
    }
  }
}
