import { Punishment, PunishmentType } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ADMIN_YOUTUBE_ID } from '@rebel/server/stores/ChannelStore'

export type CreatePunishmentArgs = {
  issuedAt: Date
  userId: number
  message: string | null
} & ({
  type: Extract<PunishmentType, 'ban'>,
} | {
  type: Extract<PunishmentType, 'timeout'>
  expirationTime: Date
})

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class PunishmentStore extends ContextClass {
  private readonly db: Db
  
  private ADMIN_USER_ID!: number

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public override async initialise (): Promise<void> {
    const adminUser = await this.db.channel.findUnique({
      where: { youtubeId: ADMIN_YOUTUBE_ID },
      rejectOnNotFound: true,
      select: { userId: true }
    })

    this.ADMIN_USER_ID = adminUser.userId
  }

  public async addPunishment (args: CreatePunishmentArgs): Promise<Punishment> {
    return await this.db.punishment.create({ data: {
      issuedAt: args.issuedAt,
      user: { connect: { id: args.userId }},
      message: args.message,
      punishmentType: args.type,
      expirationTime: args.type === 'timeout' ? args.expirationTime : null,
      adminUser: { connect: { id: this.ADMIN_USER_ID }}
    }})
  }

  public async getPunishments () {
    return await this.db.punishment.findMany()
  }
  
  public async getPunishmentsForUser (userId: number) {
    return await this.db.punishment.findMany({ where: { userId: userId }})
  }
  
  public async revokePunishment (punishmentId: number, revokedAt: Date, revokeMessage: string | null): Promise<Punishment> {
    const punishment = await this.db.punishment.findUnique({
      where: { id: punishmentId },
      rejectOnNotFound: true
    })

    if (punishment.revokedTime != null) {
      throw new Error('Punishment has already been revoked')
    }

    return await this.db.punishment.update({
      where: { id: punishmentId },
      data: { revokedTime: revokedAt, revokeMessage: revokeMessage }
    })
  }
}
