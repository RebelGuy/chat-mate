import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireAuth } from '@rebel/server/controllers/preProcessors'
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import AccountStore from '@rebel/server/stores/AccountStore'
import { EmptyObject } from '@rebel/server/types'
import { InvalidUsernameError, TimeoutError, UsernameAlreadyExistsError } from '@rebel/server/util/error'
import { sleep } from '@rebel/server/util/node'
import Semaphore from '@rebel/server/util/Semaphore'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { Path, POST, PreProcessor } from 'typescript-rest'

// prevent brute-force login attacks by limiting the number of concurrent requests
const loginSemaphore = new Semaphore(3, 10000)

type Deps = ControllerDependencies<{
  accountStore: AccountStore
  accountHelpers: AccountHelpers
}>

export type RegisterRequest = ApiRequest<1, { schema: 1, username: string, password: string }>
export type RegisterResponse = ApiResponse<1, { loginToken: string }>

export type LoginRequest = ApiRequest<1, { schema: 1, username: string, password: string }>
export type LoginResponse = ApiResponse<1, { loginToken: string }>

export type LogoutResponse = ApiResponse<1, EmptyObject>

export type AuthenticateResponse = ApiResponse<1, { username: string }>

@Path(buildPath('account'))
export default class AccountController extends ControllerBase {
  private readonly accountStore: AccountStore
  private readonly accountHelpers: AccountHelpers

  constructor (deps: Deps) {
    super(deps, 'account')
    this.accountStore = deps.resolve('accountStore')
    this.accountHelpers = deps.resolve('accountHelpers')
  }

  @POST
  @Path('register')
  public async register (request: RegisterRequest): Promise<RegisterResponse> {
    const builder = this.registerResponseBuilder<RegisterResponse>('POST /register', 1)

    if (isNullOrEmpty(request.username) || isNullOrEmpty(request.password)) {
      return builder.failure(400, 'Username and password must be provided')
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
    const builder = this.registerResponseBuilder<LoginResponse>('POST /login', 1)

    if (isNullOrEmpty(request.username) || isNullOrEmpty(request.password)) {
      return builder.failure(400, 'Username and password must be provided')
    }

    try {
      await loginSemaphore.enter()
      await sleep(2000)
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
      return builder.success({ loginToken: token })
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
    const builder = this.registerResponseBuilder<LogoutResponse>('POST /logout', 1)

    try {
      await this.apiService.authenticateCurrentUser()
      const user = super.getCurrentUser()!
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
  public authenticate (): AuthenticateResponse {
    const builder = this.registerResponseBuilder<AuthenticateResponse>('POST /authenticate', 1)

    try {
      const user = super.getCurrentUser()!
      return builder.success({ username: user.username })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
