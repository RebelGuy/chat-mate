import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth } from '@rebel/server/controllers/preProcessors'
import AccountHelpers from '@rebel/shared/helpers/AccountHelpers'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { InvalidUsernameError, NotLoggedInError, TimeoutError, UsernameAlreadyExistsError } from '@rebel/shared/util/error'
import { sleep } from '@rebel/shared/util/node'
import Semaphore from '@rebel/shared/util/Semaphore'
import { Path, POST, PreProcessor } from 'typescript-rest'
import { AuthenticateResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse, ResetPasswordRequest, ResetPasswordResponse } from '@rebel/api-models/schema/account'
import AccountService from '@rebel/server/services/AccountService'
import { nonEmptyStringValidator } from '@rebel/server/controllers/validation'

// prevent brute-force login attacks by limiting the number of concurrent requests
const loginSemaphore = new Semaphore(1, 2000)
const registerSemaphore = new Semaphore(1, 2000)

type Deps = ControllerDependencies<{
  accountStore: AccountStore
  accountHelpers: AccountHelpers
  streamerStore: StreamerStore
  accountService: AccountService
}>

@Path(buildPath('account'))
export default class AccountController extends ControllerBase {
  private readonly accountStore: AccountStore
  private readonly accountHelpers: AccountHelpers
  private readonly streamerStore: StreamerStore
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super(deps, 'account')
    this.accountStore = deps.resolve('accountStore')
    this.accountHelpers = deps.resolve('accountHelpers')
    this.streamerStore = deps.resolve('streamerStore')
    this.accountService = deps.resolve('accountService')
  }

  @POST
  @Path('register')
  public async register (request: RegisterRequest): Promise<RegisterResponse> {
    const builder = this.registerResponseBuilder<RegisterResponse>('POST /register')

    const validationError = builder.validateInput({
      username: { type: 'string', validators: [nonEmptyStringValidator] },
      password: { type: 'string', validators: [nonEmptyStringValidator] }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      await registerSemaphore.enter()
      await sleep(1000)
    } catch (e: any) {
      if (e instanceof TimeoutError)
        return builder.failure(500, new Error('Timed out. Please try again later.'))
      else {
        return builder.failure(e)
      }
    } finally {
      registerSemaphore.exit()
    }

    try {
      const username = this.accountHelpers.validateAndFormatUsername(request.username)
      await this.accountStore.addRegisteredUser({ username: username, password: request.password })
      const token = await this.accountStore.createLoginToken(username)
      return builder.success({ loginToken: token })
    } catch (e: any) {
      if (e instanceof InvalidUsernameError) {
        return builder.failure(400, e)
      } else if (e instanceof UsernameAlreadyExistsError) {
        return builder.failure(400, new UsernameAlreadyExistsError(request.username))
      }
      return builder.failure(e)
    }
  }

  @POST
  @Path('login')
  public async login (request: LoginRequest): Promise<LoginResponse> {
    const builder = this.registerResponseBuilder<LoginResponse>('POST /login')

    const validationError = builder.validateInput({
      username: { type: 'string', validators: [nonEmptyStringValidator] },
      password: { type: 'string', validators: [nonEmptyStringValidator] }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      await loginSemaphore.enter()
      await sleep(1000)
    } catch (e: any) {
      if (e instanceof TimeoutError)
        return builder.failure(500, new Error('Timed out. Please try again later.'))
      else {
        return builder.failure(e)
      }
    } finally {
      loginSemaphore.exit()
    }

    try {
      const username = this.accountHelpers.validateAndFormatUsername(request.username)
      const validPassword = await this.accountStore.checkPassword(username, request.password)
      if (!validPassword) {
        return builder.failure(401, new Error('Invalid login details'))
      }

      const token = await this.accountStore.createLoginToken(username)
      const streamer = await this.streamerStore.getStreamerByName(username)
      const user = await this.accountStore.getRegisteredUserFromName(username)
      return builder.success({ loginToken: token, displayName: user!.displayName, isStreamer: streamer != null })
    } catch (e: any) {
      if (e instanceof InvalidUsernameError) {
        return builder.failure(401, new Error('Invalid login details'))
      }
      return builder.failure(e)
    }
  }

  @POST
  @Path('logout')
  public async logout (): Promise<LogoutResponse> {
    const builder = this.registerResponseBuilder<LogoutResponse>('POST /logout')

    try {
      await this.apiService.authenticateCurrentUser()
      const user = super.getCurrentUser()
      await this.accountStore.clearLoginTokens(user.id)
    } catch (e: any) {
      // ignore
    }

    // always allow the user to log out, regardless of whether we are able to authenticate them or not.
    // this is really just a nicety for easier client-side handling
    return builder.success({})
  }

  @POST
  @Path('authenticate')
  @PreProcessor(requireAuth)
  public async authenticate (): Promise<AuthenticateResponse> {
    const builder = this.registerResponseBuilder<AuthenticateResponse>('POST /authenticate')

    try {
      const user = super.getCurrentUser()
      const streamer = await this.streamerStore.getStreamerByName(user.username)
      return builder.success({
        username: user.username,
        displayName: user.displayName,
        isStreamer: streamer != null
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @POST
  @Path('resetPassword')
  @PreProcessor(requireAuth)
  public async resetPassword (request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const builder = this.registerResponseBuilder<ResetPasswordResponse>('POST /resetPassword')

    const validationError = builder.validateInput({
      oldPassword: { type: 'string' },
      newPassword: { type: 'string', validators: [nonEmptyStringValidator] }
    }, request)
    if (validationError != null) {
      return validationError
    }

    try {
      await loginSemaphore.enter()
      await sleep(1000)

      const user = super.getCurrentUser()
      await this.accountService.resetPassword(user.id, request.oldPassword, request.newPassword)

      const token = await this.accountStore.createLoginToken(user.username)
      return builder.success({ loginToken: token })

    } catch (e: any) {
      if (e instanceof NotLoggedInError) {
        return builder.failure(401, e)
      }
      return builder.failure(e)
    } finally {
      loginSemaphore.exit()
    }
  }
}
