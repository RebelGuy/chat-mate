import { ChatUser } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { LIVESTREAM_PARTICIPATION_TYPES } from '@rebel/server/services/ChannelService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import { first, single, unique } from '@rebel/shared/util/arrays'
import { assertUnreachableCompile } from '@rebel/shared/util/typescript'
import { NotLoggedInError } from '@rebel/shared/util/error'
import LogService from '@rebel/server/services/LogService'

type Deps = Dependencies<{
  accountStore: AccountStore
  channelStore: ChannelStore
  logService: LogService
}>

export default class AccountService extends ContextClass {
  public readonly name = AccountService.name

  private readonly accountStore: AccountStore
  private readonly channelStore: ChannelStore
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()
    this.accountStore = deps.resolve('accountStore')
    this.channelStore = deps.resolve('channelStore')
    this.logService = deps.resolve('logService')
  }

  /** Gets the primary users for all channels that have participated in the streamer's chat. */
  public async getStreamerPrimaryUserIds (streamerId: number): Promise<number[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    const channels = await this.channelStore.getAllChannels(streamerId)
    return unique(channels.map(c => c.aggregateUserId ?? c.defaultUserId))
  }

  /** Retains the order of users passed in. */
  public async getPrimaryUserIdFromAnyUser (anyUserIds: number[]): Promise<number[]> {
    const connectedUserIds = await this.accountStore.getConnectedChatUserIds(anyUserIds)
    return anyUserIds.map(userId => first(connectedUserIds.find(c => c.queriedAnyUserId === userId)!.connectedChatUserIds))
  }

  /** Resets the user's password and returns a new login token.
   * @throws {@link NotLoggedInError}: When the provided old password is incorrect. */
  public async resetPassword (registeredUserId: number, oldPassword: string, newPassword: string): Promise<string> {
    const registeredUser = await this.accountStore.getRegisteredUsersFromIds([registeredUserId]).then(single)
    const isAuthenticated = await this.accountStore.checkPassword(registeredUser.username, oldPassword)
    if (!isAuthenticated) {
      throw new NotLoggedInError('Invalid login details')
    }

    await this.accountStore.clearLoginTokens(registeredUserId)
    await this.accountStore.setPassword(registeredUser.username, newPassword)

    this.logService.logInfo(this, `User ${registeredUserId} (${registeredUser.username}) has reset their password.`)
    return await this.accountStore.createLoginToken(registeredUser.username)
  }
}

export function getPrimaryUserId (userOrChannel: ChatUser | UserChannel): number {
  if ('id' in userOrChannel) {
    return userOrChannel.aggregateChatUserId ?? userOrChannel.id
  } else {
    return userOrChannel.aggregateUserId ?? userOrChannel.defaultUserId
  }
}
