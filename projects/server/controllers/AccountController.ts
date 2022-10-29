import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import AccountStore from '@rebel/server/stores/AccountStore'
import { InvalidUsernameError } from '@rebel/server/util/error'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { Path, POST } from 'typescript-rest'

type Deps = ControllerDependencies<{
  accountStore: AccountStore
  accountHelpers: AccountHelpers
}>

type RegisterRequest = ApiRequest<1, { schema: 1, username: string, password: string }>
type RegisterResponse = ApiResponse<1, { loginToken: string }>

type LoginRequest = ApiRequest<1, { schema: 1, username: string, password: string }>
type LoginResponse = ApiResponse<1, { loginToken: string }>

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
}
