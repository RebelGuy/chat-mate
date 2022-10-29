abstract class CustomError extends Error {
  constructor (proto: object, message?: string) {
    super(message)
    Object.setPrototypeOf(this, proto)
  }
}

export class TimeoutError extends CustomError {
  public readonly timeout?: number

  constructor (message?: string, timeout?: number) {
    super(TimeoutError.prototype, message)
    this.timeout = timeout
  }
}

export class UserRankNotFoundError extends CustomError {
  constructor (message?: string){
    super(UserRankNotFoundError.prototype, message ?? 'The user-rank could not be found.')
  }
}

export class UserRankAlreadyExistsError extends CustomError {
  constructor (message?: string){
    super(UserRankAlreadyExistsError.prototype, message ?? 'The user-rank already exists.')
  }
}

export class ApiResponseError extends CustomError {
  constructor (status: number, errorType?: string, errorDescription?: string) {
    super(ApiResponseError.prototype, `Request failed with code ${status}: ${errorType ?? 'Unknown error'}. ${errorDescription ?? 'No further details available'}`)
  }
}

export class DonationUserLinkAlreadyExistsError extends CustomError {
  constructor () {
    super(DonationUserLinkAlreadyExistsError.prototype, `Cannot link the user to the donation because another user is already linked. Please unlink the other user first.`)
  }
}

export class DonationUserLinkNotFoundError extends CustomError {
  constructor () {
    super(DonationUserLinkNotFoundError.prototype, `Cannot unlink the user from the donation because no user is linked.`)
  }
}

export class InvalidUsernameError extends CustomError {
  constructor (msg: string) {
    super(InvalidUsernameError.prototype, `Invalid username: ${msg}`)
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
