import { Punishment, PunishmentType } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import PunishmentStore, { CreatePunishmentArgs } from '@rebel/server/stores/PunishmentStore'
import { assertUnreachable } from '@rebel/server/util/typescript'

// It is not an issue on Twitch, but on Youtube we come across the interesting problem of being unable to check
// the current list of on-platform punishments. This means that, when a punishment occurrs, the platform data
// may not be in sync with the DB data. Therefore, when a new punishment is requested in this service, we will
// attempt to apply the on-platform punishment, and then add or refresh (revoke and re-apply) the punishment
// in the DB. This way, we are guaranteed that data is always in sync after a new punishment has been requested
// (assuming the external request succeeded).
// Finally, while it is not an error to request the same punishment multiple times in succession, it should
// generally be avoided to reduce clutter in the punishment history of the user.

type Deps = Dependencies<{
  logService: LogService
  masterchatProxyService: MasterchatProxyService
  twurpleService: TwurpleService
  punishmentStore: PunishmentStore
  channelStore: ChannelStore
  chatStore: ChatStore
}>

export default class PunishmentService extends ContextClass {
  public readonly name = PunishmentService.name

  private readonly logService: LogService
  private readonly masterchat: MasterchatProxyService
  private readonly twurpleService: TwurpleService
  private readonly punishmentStore: PunishmentStore
  private readonly channelStore: ChannelStore
  private readonly chatStore: ChatStore

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.masterchat = deps.resolve('masterchatProxyService')
    this.twurpleService = deps.resolve('twurpleService')
    this.punishmentStore = deps.resolve('punishmentStore')
    this.channelStore = deps.resolve('channelStore')
    this.chatStore = deps.resolve('chatStore')
  }

  public async getCurrentPunishments (): Promise<Punishment[]> {
    const punishments = await this.punishmentStore.getPunishments()
    return punishments.filter(currentPunishmentsFilter)
  }

  public async banUser (userId: number, message: string | null): Promise<Punishment> {
    const ownedChannels = await this.channelStore.getUserOwnedChannels(userId)
    await Promise.all(ownedChannels.youtubeChannels.map(c => this.tryApplyYoutubePunishment(c, 'ban')))
    await Promise.all(ownedChannels.twitchChannels.map(c => this.tryApplyTwitchPunishment(c, message, 'ban')))

    const currentPunishments = await this.getCurrentPunishmentsForUser(userId)
    await Promise.all(currentPunishments
      .filter(p => p.punishmentType === 'ban')
      .map(p => this.punishmentStore.revokePunishment(p.id, new Date(), 'Sync DB and platform ban states')))

    const args: CreatePunishmentArgs = {
      type: 'ban',
      issuedAt: new Date(),
      message: message,
      userId: userId
    }
    return await this.punishmentStore.addPunishment(args)
  }

  /** Returns the updated punishment, if there was one. */
  public async unbanUser (userId: number, unbanMessage: string | null): Promise<Punishment | null> {
    const ownedChannels = await this.channelStore.getUserOwnedChannels(userId)
    await Promise.all(ownedChannels.youtubeChannels.map(c => this.tryApplyYoutubePunishment(c, 'unban')))
    await Promise.all(ownedChannels.twitchChannels.map(c => this.tryApplyTwitchPunishment(c, unbanMessage, 'unban')))

    const currentPunishments = await this.getCurrentPunishmentsForUser(userId)
    const ban = currentPunishments.find(p => p.punishmentType === 'ban')
    if (ban == null) {
      this.logService.logWarning(this, `Can't unban user ${userId} because they are not currently banned`)
      return null
    }

    return await this.punishmentStore.revokePunishment(ban.id, new Date(), unbanMessage)
  }

  private async getCurrentPunishmentsForUser (userId: number) {
    const allPunishments = await this.punishmentStore.getPunishmentsForUser(userId)
    return allPunishments.filter(currentPunishmentsFilter)
  }

  private async tryApplyYoutubePunishment (channelId: number, type: 'ban' | 'unban'): Promise<void> {
    let request: (contextToken: string) => Promise<boolean>
    if (type === 'ban') {
      request = this.masterchat.banYoutubeChannel
    } else if (type === 'unban') {
      request = this.masterchat.unbanYoutubeChannel
    } else {
      assertUnreachable(type)
    }

    const lastChatItem = await this.chatStore.getLastChatByYoutubeChannel(channelId)
    if (lastChatItem == null) {
      this.logService.logWarning(this, `Could not ${type} youtube channel ${channelId} because no chat item was found for the channel`)
      return
    } else if (lastChatItem.contextToken == null) {
      this.logService.logWarning(this, `Could not ${type} youtube channel ${channelId} because the most recent chat item did not contain a context token`)
      return
    }
    
    try {
      const result = await request(lastChatItem.contextToken)
      this.logService.logInfo(this, `Request to ${type} youtube channel ${channelId} succeeded. Action applied: ${result}`)
    } catch (e: any) {
      this.logService.logError(this, `Request to ${type} youtube channel ${channelId} failed:`, e.message)
    }
  }

  private async tryApplyTwitchPunishment (channelId: number, reason: string | null, type: 'ban' | 'unban'): Promise<void> {
    let request: (channelId: number, reason: string | null) => Promise<void>
    if (type === 'ban') {
      request = this.twurpleService.banChannel
    } else if (type === 'unban') {
      request = this.twurpleService.unbanChannel
    } else {
      assertUnreachable(type)
    }

    try {
      // if the punishment is already applied, twitch will just send an Notice message which we can ignore
      await request(channelId, reason)
      this.logService.logInfo(this, `Request to ${type} twitch channel ${channelId} succeeded.`)
    } catch (e: any) {
      this.logService.logError(this, `Request to ${type} twitch channel ${channelId} failed:`, e.message)
    }
  }
}

const currentPunishmentsFilter = (p: Punishment) =>  (p.expirationTime == null || p.expirationTime > new Date()) && p.revokedTime == null
