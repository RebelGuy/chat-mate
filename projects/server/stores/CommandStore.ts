import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { NormalisedCommand } from '@rebel/server/services/CommandService'
import { ensureMaxTextWidth } from '@rebel/server/util/text'


type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class CommandStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  /** Returns the id of the newly created command. */
  public async addCommand (chatMessageId: number, normalisedCommand: NormalisedCommand): Promise<number> {
    const command = await this.db.chatCommand.create({ data: {
      normalisedCommandName: normalisedCommand.normalisedName,
      chatMessageId: chatMessageId
    }})

    return command.id
  }

  public async executionStarted (commandId: number) {
    await this.db.chatCommand.update({
      where: { id: commandId },
      data: { startTime: new Date() }
    })
  }

  public async executionFinished (commandId: number, result: string) {
    await this.db.chatCommand.update({
      where: { id: commandId },
      data: {
        endTime: new Date(),
        result: ensureMaxTextWidth(result, 1024) // based on the max column length specified in the schema
      }
    })
  }

  public async executionFailed (commandId: number, errorMessage: string) {
    await this.db.chatCommand.update({
      where: { id: commandId },
      data: {
        endTime: new Date(),
        error: ensureMaxTextWidth(errorMessage, 1024) // based on the max column length specified in the schema
      }
    })
  }

  public async getCommand (commandId: number) {
    return await this.db.chatCommand.findUnique({
      where: { id: commandId },
      include: { chatMessage: true },
      rejectOnNotFound: true
    })
  }
}
