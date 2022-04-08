import { Punishment, PunishmentType } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import PunishmentStore, { CreatePunishmentArgs } from '@rebel/server/stores/PunishmentStore'

type Deps = Dependencies<{
  masterchatProvider: MasterchatProvider
  punishmentStore: PunishmentStore
}>

export default class PunishmentService extends ContextClass {
  private readonly masterchat: IMasterchat
  private readonly punishmentStore: PunishmentStore

  constructor (deps: Deps) {
    super()

    this.masterchat = deps.resolve('masterchatProvider').get()
    this.punishmentStore = deps.resolve('punishmentStore')
  }

  public async getCurrentPunishments (): Promise<Punishment[]> {
    const punishments = await this.punishmentStore.getPunishments()
    const now = new Date()
    return punishments.filter(currentPunishmentsFilter)
  }

  public async banUser (userId: number, message: string | null) {
    const currentPunishments = await this.getCurrentPunishmentsForUser(userId)
    if (currentPunishments.find(p => p.punishmentType === 'ban')) {
      throw new Error('User is already banned')
    }

    const args: CreatePunishmentArgs = {
      type: 'ban',
      issuedAt: new Date(),
      message: message,
      userId: userId
    }
    await this.punishmentStore.addPunishment(args)
  }

  public async unbanUser (userId: number, unbanMessage: string | null) {
    const currentPunishments = await this.getCurrentPunishmentsForUser(userId)
    const ban = currentPunishments.find(p => p.punishmentType === 'ban')
    if (ban == null) {
      throw new Error('User is not currently banned')
    }

    await this.punishmentStore.revokePunishment(ban.id, new Date(), unbanMessage)
  }

  private async getCurrentPunishmentsForUser (userId: number) {
    const allPunishments = await this.punishmentStore.getPunishmentsForUser(userId)
    return allPunishments.filter(currentPunishmentsFilter)
  }
}

const currentPunishmentsFilter = (p: Punishment) =>  p.expirationTime == null || p.expirationTime <= new Date() || p.revokedTime != null
