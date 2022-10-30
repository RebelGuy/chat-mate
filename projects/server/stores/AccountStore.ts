import { RegisteredUser } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
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

  public async addRegisteredUser (registeredUser: RegisteredUserCreateArgs) {
    const hashedPassword = hashString(registeredUser.password)
    await this.db.registeredUser.create({ data: {
      username: registeredUser.username,
      hashedPassword: hashedPassword
    }})
  }

  public async checkPassword (username: string, password: string): Promise<boolean> {
    const hashedPassword = hashString(password)
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

  public async getRegisteredUserFromToken (token: string): Promise<RegisteredUser | null> {
    const result = await this.db.loginToken.findUnique({
      where: { token: token },
      rejectOnNotFound: false,
      include: { registeredUser: true }
    })
    return result?.registeredUser ?? null
  }
}
