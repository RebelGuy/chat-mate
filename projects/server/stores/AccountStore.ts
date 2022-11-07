import { Prisma, RegisteredUser } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { UsernameAlreadyExistsError } from '@rebel/server/util/error'
import { randomString } from '@rebel/server/util/random'
import { hashString } from '@rebel/server/util/strings'

export type RegisteredUserCreateArgs = {
  username: string
  password: string
}

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class AccountStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  /** @throws {@link UsernameAlreadyExistsError}: When a registered user with the same username already exists. */
  public async addRegisteredUser (registeredUser: RegisteredUserCreateArgs) {
    // this generates a unique hash even if multiple users use the same password
    const hashedPassword = hashString(registeredUser.username + registeredUser.password)

    try {
      await this.db.registeredUser.create({ data: {
        username: registeredUser.username,
        hashedPassword: hashedPassword
      }})
    } catch (e: any) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new UsernameAlreadyExistsError(registeredUser.username)
      }
      throw e
    }
  }

  public async checkPassword (username: string, password: string): Promise<boolean> {
    const hashedPassword = hashString(username + password)
    const match = await this.db.registeredUser.findUnique({
      where: { username: username },
      rejectOnNotFound: false
    })

    return match?.hashedPassword === hashedPassword
  }

  public async clearLoginTokens (registeredUserId: number) {
    await this.db.loginToken.deleteMany({
      where: { registeredUserId }
    })
  }

  public async createLoginToken (username: string): Promise<string> {
    const token = randomString(8)
    await this.db.loginToken.create({ data: {
      token: token,
      registeredUser: { connect: { username: username }}
    }})
    return token
  }

  public async getRegisteredUserFromId (registeredUserId: number): Promise<RegisteredUser | null> {
    return await this.db.registeredUser.findFirst({
      where: { id: registeredUserId }
    })
  }

  public async getRegisteredUserFromToken (token: string): Promise<RegisteredUser | null> {
    const result = await this.db.loginToken.findUnique({
      where: { token: token },
      rejectOnNotFound: false,
      include: { registeredUser: true }
    })
    return result?.registeredUser ?? null
  }

  public async getRegisteredUserFromChatUser (chatUserId: number): Promise<RegisteredUser | null> {
    return await this.db.registeredUser.findFirst({
      where: { chatUserId }
    })
  }
}
