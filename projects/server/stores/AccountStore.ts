import { Prisma, RegisteredUser } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group } from '@rebel/server/util/arrays'
import { UsernameAlreadyExistsError } from '@rebel/server/util/error'
import { randomString } from '@rebel/server/util/random'
import { hashString } from '@rebel/server/util/strings'

export type RegisteredUserCreateArgs = {
  username: string
  password: string
}

export type ConnectedChatUserIds = {
  queriedAnyUserId: number

  /** The first user id is the primary user. */
  connectedChatUserIds: number[]
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

  /** For each of the given chat users, returns the registered user that they belong to. */
  public async getRegisteredUsers (anyUserIds: number[]): Promise<{ primaryUserId: number, registeredUser: RegisteredUser | null }[]> {
    const aggregateChatUsers = await this.db.chatUser.findMany({
      where: {
        id: { in: anyUserIds },
        NOT: { registeredUser: null }
      },
      include: { registeredUser: true }
    })
    const defaultChatUsers = await this.db.chatUser.findMany({
      where: {
        id: { in: anyUserIds },
        registeredUser: null
      },
      include: { aggregateChatUser: { include: { registeredUser: true }}}
    })

    return anyUserIds.map(id => {
      const aggregateChatUser = aggregateChatUsers.find(user => user.id === id)
      if (aggregateChatUser != null) {
        return {
          primaryUserId: id,
          registeredUser: aggregateChatUser.registeredUser!
        }
      }

      const defaultChatUser = defaultChatUsers.find(user => user.id === id)
      if (defaultChatUser != null) {
        return {
          primaryUserId: id,
          registeredUser: defaultChatUser.aggregateChatUser?.registeredUser ?? null
        }
      }

      throw new Error(`User with anyUserId ${id} was identified as neither an aggregate user nor a default user.`)
    })
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
  public async getConnectedChatUserIds (anyUserIds: number[]): Promise<ConnectedChatUserIds[]> {
    const chatUsers = await this.db.chatUser.findMany({
      where: { id: { in: anyUserIds } },
      include: { registeredUser: true, aggregateChatUser: true }
    })

    let result: ConnectedChatUserIds[] = []

    // handle aggregate users and their linked users
    const aggregateUserIds = chatUsers.filter(user => user.registeredUser != null).map(user => user.id)
    const defaultUsersOfAggregateUsers = await this.db.chatUser.findMany({
      where: { aggregateChatUserId: { in: aggregateUserIds }}
    })
    aggregateUserIds.forEach(aggregateUserId => result.push({
      queriedAnyUserId: aggregateUserId,
      connectedChatUserIds: [aggregateUserId, ...defaultUsersOfAggregateUsers.filter(user => user.aggregateChatUserId === aggregateUserId).map(user => user.id)]
    }))

    // handle default users linked to aggregate users
    const linkedDefaultUsers = chatUsers.filter(user => user.aggregateChatUserId != null)
    const siblingDefaultUsers = await this.db.chatUser.findMany({
      where: { aggregateChatUserId: { in: linkedDefaultUsers.map(user => user.aggregateChatUserId!) }}
    })
    linkedDefaultUsers.forEach(defaultUser => result.push({
      queriedAnyUserId: defaultUser.id,
      // note that siblings include the default user in question
      connectedChatUserIds: [defaultUser.aggregateChatUserId!, ...siblingDefaultUsers.filter(user => user.aggregateChatUserId === defaultUser.aggregateChatUserId).map(user => user.id)]
    }))

    // handle default users not linked to aggregate users
    const singleDefaultUserIds = chatUsers.filter(user => user.registeredUser == null && user.aggregateChatUserId == null).map(user => user.id)
    singleDefaultUserIds.forEach(userId => result.push({
      queriedAnyUserId: userId,
      connectedChatUserIds: [userId]
    }))

    return result
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
