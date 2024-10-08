import { RegisteredUser, Streamer, StreamerApplication } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { StreamerApplicationAlreadyClosedError, UserAlreadyStreamerError } from '@rebel/shared/util/error'
import { PRISMA_CODE_UNIQUE_CONSTRAINT_FAILED, isKnownPrismaError } from '@rebel/server/prismaUtil'

export type StreamerApplicationWithUser = StreamerApplication & {
  registeredUser: RegisteredUser
}

export type CreateApplicationArgs = {
  registeredUserId: number
  message: string
}

export type CloseApplicationArgs = {
  id: number
  approved: boolean | null
  message: string | null
}

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class StreamerStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  /** @throws {@link UserAlreadyStreamerError}: When the registered user is already a streamer. */
  public async addStreamer (registeredUserId: number): Promise<Streamer> {
    try {
      return await this.db.streamer.create({ data: { registeredUserId }})
    } catch (e: any) {
      if (isKnownPrismaError(e) && e.innerError.code === PRISMA_CODE_UNIQUE_CONSTRAINT_FAILED) {
        throw new UserAlreadyStreamerError()
      }

      throw e
    }
  }

  public async addStreamerApplication (data: CreateApplicationArgs): Promise<StreamerApplicationWithUser> {
    return await this.db.streamerApplication.create({
      data: {
        registeredUserId: data.registeredUserId,
        message: data.message
      },
      include: { registeredUser: true }
    })
  }

  /** @throws {@link StreamerApplicationAlreadyClosedError}: When attempting to close an application that has already been closed. */
  public async closeStreamerApplication (data: CloseApplicationArgs): Promise<StreamerApplicationWithUser> {
    const application = await this.db.streamerApplication.findUniqueOrThrow({
      where: { id: data.id }
    })

    if (application.timeClosed != null) {
      throw new StreamerApplicationAlreadyClosedError()
    }

    return await this.db.streamerApplication.update({
      where: { id: data.id },
      data: {
        closeMessage: data.message,
        timeClosed: new Date(),
        isApproved: data.approved
      },
      include: { registeredUser: true }
    })
  }

  public async getStreamers (): Promise<Streamer[]> {
    return await this.db.streamer.findMany({})
  }

  public async getStreamersSince (since: number): Promise<Streamer[]> {
    return await this.db.streamer.findMany({ where: {
      time: { gte: new Date(since) }
    }})
  }

  /** Gets the list of all applications by the user or, if not defined, by all users. */
  public async getStreamerApplications (registeredUserId: number | undefined): Promise<StreamerApplicationWithUser[]> {
    return await this.db.streamerApplication.findMany({
      where: { registeredUserId },
      include: { registeredUser: true }
    })
  }

  public async getStreamerById (streamerId: number): Promise<Streamer | null> {
    return await this.db.streamer.findFirst({
      where: { id: streamerId }
    })
  }

  public async getStreamerByName (username: string): Promise<Streamer | null> {
    return await this.db.streamer.findFirst({
      where: { registeredUser: { username }}
    })
  }

  public async getStreamerByRegisteredUserId (registeredUserId: number): Promise<Streamer | null> {
    return await this.db.streamer.findFirst({
      where: { registeredUserId }
    })
  }
}
