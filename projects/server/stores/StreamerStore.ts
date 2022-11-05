import { RegisteredUser, Streamer, StreamerApplication } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { StreamerApplicationAlreadyClosedError, UserAlreadyStreamerError } from '@rebel/server/util/error'

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
  public async addStreamer (registeredUserId: number) {
    try {
      await this.db.streamer.create({ data: { registeredUserId }})
    } catch (e: any) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
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
    const application = await this.db.streamerApplication.findUnique({
      where: { id: data.id },
      rejectOnNotFound: true
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

  public async getStreamerApplications (): Promise<StreamerApplicationWithUser[]> {
    return await this.db.streamerApplication.findMany({
      include: { registeredUser: true }
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
