abstract class CustomError extends Error {
  constructor (proto: object, message?: string) {
    super(message)
    Object.setPrototypeOf(this, proto)
  }
}

export class NotFoundError extends CustomError {
  constructor (message: string) {
    super(NotFoundError.prototype, message)
  }
}

export class ForbiddenError extends CustomError {
  constructor (message: string) {
    super(ForbiddenError.prototype, message)
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

export class UserRankRequiresStreamerError extends CustomError {
  constructor (message?: string){
    super(UserRankRequiresStreamerError.prototype, message ?? 'The user-rank can only be applied in a streamer context.')
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

export class UsernameAlreadyExistsError extends CustomError {
  constructor (username: string) {
    super(UsernameAlreadyExistsError.prototype, `The username '${username}' already exists.`)
  }
}

export class StreamerApplicationAlreadyClosedError extends CustomError {
  constructor () {
    super(StreamerApplicationAlreadyClosedError.prototype, `The streamer application is already closed.`)
  }
}

export class UserAlreadyStreamerError extends CustomError {
  constructor () {
    super(UserAlreadyStreamerError.prototype, `The user is already a streamer.`)
  }
}

export class PreProcessorError extends CustomError {
  public readonly statusCode: number

  constructor (statusCode: number, message: string) {
    super(PreProcessorError.prototype, message)
    this.statusCode = statusCode
  }
}

export class UserAlreadyLinkedToAggregateUserError extends CustomError {
  public readonly aggregateUserId: number
  public readonly defaultUserId: number

  constructor (message: string, aggregateUserId: number, defaultUserId: number) {
    super(UserAlreadyLinkedToAggregateUserError.prototype, message)
    this.aggregateUserId = aggregateUserId
    this.defaultUserId = defaultUserId
  }
}

export class LinkAttemptInProgressError extends CustomError {
  constructor (message: string) {
    super(LinkAttemptInProgressError.prototype, message)
  }
}

export class UserNotLinkedError extends CustomError {
  constructor (message?: string) {
    super(UserNotLinkedError.prototype, message)
  }
}

export class UnknownCommandError extends CustomError {
  constructor (normalisedCommandName: string) {
    super(UnknownCommandError.prototype, `Unknown command '${normalisedCommandName}'`)
  }
}

export class InvalidCommandArgumentsError extends CustomError {
  constructor (message: string) {
    super(InvalidCommandArgumentsError.prototype, 'Invalid arguments: ' + message)
  }
}

export class NotAuthorisedError extends CustomError {
  constructor (twitchUserId: string) {
    super(NotAuthorisedError.prototype, `Twitch user ${twitchUserId} has not authorised ChatMate.`)
  }
}

export class AuthorisationExpiredError extends CustomError {
  constructor () {
    super(AuthorisationExpiredError.prototype)
  }
}

export class InconsistentScopesError extends CustomError {
  constructor () {
    super(InconsistentScopesError.prototype, 'The stored application scope differs from the expected scope. Please reset the Twitch authentication as described in the readme.')
  }
}

export class NoYoutubeChatMessagesError extends CustomError {
  constructor (message: string) {
    super(NoYoutubeChatMessagesError.prototype, message)
  }
}

export class NoContextTokenError extends CustomError {
  constructor (message: string) {
    super(NoContextTokenError.prototype, message)
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
