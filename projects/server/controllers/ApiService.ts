import { RegisteredUser } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import AccountStore from '@rebel/server/stores/AccountStore'
import { PreProcessorError } from '@rebel/server/util/error'
import { Request, Response } from 'express'
import { Errors } from 'typescript-rest'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'

type Deps = Dependencies<{
  request: Request
  response: Response
  accountStore: AccountStore
}>

// we could do a lot of these things directly in the ControllerBase, but it will be trickier to get the preProcessors to work because we don't know which controller instance from the context to use
export default class ApiService extends ContextClass {
  private readonly accountStore: AccountStore
  private readonly request: Request
  private readonly response: Response

  private registeredUser: RegisteredUser | null = null

  constructor (deps: Deps) {
    super()
    this.request = deps.resolve('request')
    this.response = deps.resolve('response')
    this.accountStore = deps.resolve('accountStore')
  }

  /** If this method runs to completion, `getCurrentUser` will return a non-null object.
   * @throws {@link PreProcessorError}: When the user could not be authenticated. */
  public async authenticateCurrentUser (): Promise<void> {
    const loginToken = this.request.headers[LOGIN_TOKEN_HEADER.toLowerCase()]
    if (loginToken == null) {
      throw new PreProcessorError(401, `The ${LOGIN_TOKEN_HEADER} header is required for authentication.`)
    } else if (Array.isArray(loginToken)) {
      throw new PreProcessorError(400, `The ${LOGIN_TOKEN_HEADER} header was malformed.`)
    }

    this.registeredUser = await this.accountStore.getRegisteredUserFromToken(loginToken)

    if (this.registeredUser == null) {
      throw new PreProcessorError(401, 'Invalid login session. Please login again.')
    }
  }

  public getCurrentUser (): RegisteredUser | null {
    return this.registeredUser
  }
}
