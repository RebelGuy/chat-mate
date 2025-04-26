export class ChatMateError extends Error {
  constructor (proto: object, message?: string)
  constructor (message?: string)
  constructor (protoOrMessage: object | string | undefined, maybeMessage?: string) {
    let proto: object
    let message: string | undefined
    if (protoOrMessage == null || typeof protoOrMessage === 'string') {
      message = protoOrMessage
      proto = ChatMateError.prototype
    } else {
      message = maybeMessage
      proto = protoOrMessage
    }

    super(message)
    Object.setPrototypeOf(this, proto)
  }
}

export class DbError<TInnerError extends Error> extends ChatMateError {
  public readonly innerError: TInnerError

  constructor (innerError: TInnerError) {
    super(DbError.prototype, innerError.message)
    this.innerError = innerError
  }
}

export abstract class UnknownChatMateError extends ChatMateError {
  constructor (message: string) {
    super(UnknownChatMateError.prototype, message)
  }
}

export class NotFoundError extends ChatMateError {
  constructor (message: string) {
    super(NotFoundError.prototype, message)
  }
}

export class ForbiddenError extends ChatMateError {
  constructor (message: string) {
    super(ForbiddenError.prototype, message)
  }
}

export class TimeoutError extends ChatMateError {
  public readonly timeout?: number

  constructor (message?: string, timeout?: number) {
    super(TimeoutError.prototype, message)
    this.timeout = timeout
  }
}

export class UserRankNotFoundError extends ChatMateError {
  constructor (message?: string){
    super(UserRankNotFoundError.prototype, message ?? 'The user-rank could not be found.')
  }
}

export class UserRankAlreadyExistsError extends ChatMateError {
  constructor (message?: string){
    super(UserRankAlreadyExistsError.prototype, message ?? 'The user-rank already exists.')
  }
}

export class UserRankRequiresStreamerError extends ChatMateError {
  constructor (message?: string){
    super(UserRankRequiresStreamerError.prototype, message ?? 'The user-rank can only be applied in a streamer context.')
  }
}

export class InvalidCustomRankError extends ChatMateError {
  constructor (invalidRankName: string){
    super(InvalidCustomRankError.prototype, `Invalid rank: ${invalidRankName}`)
  }
}

export class InvalidCustomRankNameError extends ChatMateError {
  constructor (msg: string){
    super(InvalidCustomRankNameError.prototype, `Invalid rank name: ${msg}`)
  }
}

export class ApiResponseError extends ChatMateError {
  constructor (status: number, errorType?: string, errorDescription?: string) {
    super(ApiResponseError.prototype, `Request failed with code ${status}: ${errorType ?? 'Unknown error'}. ${errorDescription ?? 'No further details available'}`)
  }
}

export class DonationUserLinkAlreadyExistsError extends ChatMateError {
  constructor () {
    super(DonationUserLinkAlreadyExistsError.prototype, `Cannot link the user to the donation because another user is already linked. Please unlink the other user first.`)
  }
}

export class DonationUserLinkNotFoundError extends ChatMateError {
  constructor () {
    super(DonationUserLinkNotFoundError.prototype, `Cannot unlink the user from the donation because no user is linked.`)
  }
}

export class InvalidUsernameError extends ChatMateError {
  constructor (msg: string) {
    super(InvalidUsernameError.prototype, `Invalid username: ${msg}`)
  }
}

export class UsernameAlreadyExistsError extends ChatMateError {
  constructor (username: string) {
    super(UsernameAlreadyExistsError.prototype, `The username '${username}' already exists.`)
  }
}

export class StreamerApplicationAlreadyClosedError extends ChatMateError {
  constructor () {
    super(StreamerApplicationAlreadyClosedError.prototype, `The streamer application is already closed.`)
  }
}

export class UserAlreadyStreamerError extends ChatMateError {
  constructor () {
    super(UserAlreadyStreamerError.prototype, `The user is already a streamer.`)
  }
}

export class PreProcessorError extends ChatMateError {
  public readonly statusCode: number

  constructor (statusCode: number, message: string) {
    super(PreProcessorError.prototype, message)
    this.statusCode = statusCode
  }
}

export class UserAlreadyLinkedToAggregateUserError extends ChatMateError {
  public readonly aggregateUserId: number
  public readonly defaultUserId: number

  constructor (message: string, aggregateUserId: number, defaultUserId: number) {
    super(UserAlreadyLinkedToAggregateUserError.prototype, message)
    this.aggregateUserId = aggregateUserId
    this.defaultUserId = defaultUserId
  }
}

export class LinkAttemptInProgressError extends ChatMateError {
  constructor (message: string) {
    super(LinkAttemptInProgressError.prototype, message)
  }
}

export class UserNotLinkedError extends ChatMateError {
  constructor (message?: string) {
    super(UserNotLinkedError.prototype, message)
  }
}

export class UnknownCommandError extends ChatMateError {
  constructor (normalisedCommandName: string) {
    super(UnknownCommandError.prototype, `Unknown command '${normalisedCommandName}'`)
  }
}

export class InvalidCommandArgumentsError extends ChatMateError {
  constructor (message: string) {
    super(InvalidCommandArgumentsError.prototype, 'Invalid arguments: ' + message)
  }
}

export class TwitchNotAuthorisedError extends ChatMateError {
  constructor (twitchUserId: string) {
    super(TwitchNotAuthorisedError.prototype, `Twitch user ${twitchUserId} has not authorised ChatMate.`)
  }
}

export class YoutubeNotAuthorisedError extends ChatMateError {
  constructor (youtubeChannelId: string) {
    super(YoutubeNotAuthorisedError.prototype, `Youtube channel ${youtubeChannelId} has not authorised ChatMate.`)
  }
}

export class AuthorisationExpiredError extends ChatMateError {
  constructor () {
    super(AuthorisationExpiredError.prototype)
  }
}

export class InconsistentScopesError extends ChatMateError {
  constructor (type: 'stored' | 'authenticated') {
    const message = type === 'stored'
      ? 'The stored application scope differs from the expected scope. Please reset the authentication as described in the readme.'
      : 'You must give ChatMate all requested permissions.'
    super(InconsistentScopesError.prototype, message)
  }
}

export class InvalidAuthenticatedChannelError extends ChatMateError {
  constructor (expectedExternalChannelId: string, actualExternalChannelId: string) {
    super(InvalidAuthenticatedChannelError.prototype, `ChatMate has been authorised with channel id ${actualExternalChannelId} but expected channel id ${expectedExternalChannelId}.`)
  }
}

export class NoYoutubeChatMessagesError extends ChatMateError {
  constructor (message: string) {
    super(NoYoutubeChatMessagesError.prototype, message)
  }
}

export class NoContextTokenError extends ChatMateError {
  constructor (message: string) {
    super(NoContextTokenError.prototype, message)
  }
}

export class ChatMessageForStreamerNotFoundError extends ChatMateError {
  constructor (message: string) {
    super(ChatMessageForStreamerNotFoundError.prototype, message)
  }
}

export class NotLoggedInError extends ChatMateError {
  constructor (message: string) {
    super(NotLoggedInError.prototype, message)
  }
}

export class PrimaryChannelAlreadyExistsError extends ChatMateError {
  constructor (streamerId: number, platform: 'youtube' | 'twitch') {
    super(PrimaryChannelAlreadyExistsError.prototype, `A primary ${platform} channel for streamer ${streamerId} already exists.`)
  }
}

export class PrimaryChannelNotFoundError extends ChatMateError {
  constructor (streamerId: number, platform: 'youtube' | 'twitch') {
    super(PrimaryChannelNotFoundError.prototype, `A primary ${platform} channel for streamer ${streamerId} has not been set.`)
  }
}

export class UnsupportedFilteTypeError extends ChatMateError {
  constructor (message: string) {
    super(UnsupportedFilteTypeError.prototype, message)
  }
}

export class InvalidEmojiMessagePartError extends ChatMateError {
  constructor (message: string) {
    super(InvalidEmojiMessagePartError.prototype, message)
  }
}

export class NonDisposableClassError extends ChatMateError {
  constructor () {
    super(NonDisposableClassError.prototype, `This is a singleton class and cannot be disposed. Its lifetime should span the lifespan of the application.`)
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
