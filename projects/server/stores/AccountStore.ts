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
        hashedPassword: hashedPassword,

        // create a new aggregate chat user
        aggregateChatUser: { create: {}}
      }})
    } catch (e: any) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new UsernameAlreadyExistsError(registeredUser.username)
      }
      throw e
    }
  }

  /** For each of the given users, checks whether they are an aggregate user, or have an aggregate user linked to them and therefore belong to a registered user. */
  public async areUsersRegistered (anyUserIds: number[]): Promise<{ userId: number, isRegistered: boolean }[]> {
    const chatUsers = await this.db.chatUser.findMany({
      where: { id: { in: anyUserIds }},
      include: { registeredUser: true }
    })
    return chatUsers.map(user => ({ userId: user.id, isRegistered: user.registeredUser != null || user.aggregateChatUserId != null }))
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

  /** Returns all chat user ids, including the given id, that are connected to the given id. The first id is always the primary id, i.e. aggregate user, if it exists.
   * Otherwise, the first (and only) item is the user id that is being queried. */
  public async getConnectedChatUserIds (chatUserId: number): Promise<number[]> {
    const chatUser = await this.db.chatUser.findFirst({
      where: { id: chatUserId },
      include: { registeredUser: true, aggregateChatUser: true }
    })

    if (chatUser!.registeredUser != null) {
      // is an aggregate user
      const defaultUsers = await this.db.chatUser.findMany({
        where: { aggregateChatUserId: chatUserId }
      })
      return [chatUserId, ...defaultUsers.map(u => u.id)]

    } else if (chatUser!.aggregateChatUserId != null) {
      // is linked to an aggreate user
      const defaultUsers = await this.db.chatUser.findMany({
        where: { aggregateChatUserId: chatUser!.aggregateChatUserId }
      })
      return [chatUser!.aggregateChatUserId, ...defaultUsers.map(u => u.id)]

    } else {
      // is a default user
      return [chatUserId]
    }
  }

  public async getRegisteredUsersFromIds (registeredUserIds: number[]): Promise<RegisteredUser[]> {
    return await this.db.registeredUser.findMany({
      where: { id: { in: registeredUserIds } }
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

  public async getRegisteredUserFromAggregateUser (aggregateChatUserId: number): Promise<RegisteredUser | null> {
    return await this.db.registeredUser.findFirst({
      where: { aggregateChatUserId }
    })
  }
}
