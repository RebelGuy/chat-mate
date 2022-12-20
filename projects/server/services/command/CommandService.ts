import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import LogService from '@rebel/server/services/LogService'
import ChatStore from '@rebel/server/stores/ChatStore'
import CommandStore from '@rebel/server/stores/CommandStore'
import { InvalidCommandArgumentsError, UnknownCommandError } from '@rebel/server/util/error'
import Semaphore from '@rebel/server/util/Semaphore'

export type NormalisedCommand = {
  normalisedName: string
}

export interface ICommand {
  /** Returns the array of normalised names by which the command is known. */
  normalisedNames: ReadonlyArray<string>

  /** The `defaultUserId` is the id of the executor. If this method resolves, it is assumed that it successfully ran to completion.
   * @throws {@link InvalidCommandArgumentsError}: When the arguments provided to the command are invalid.
  */
  executeCommand: (defaultUserId: number, args: string[]) => Promise<string | null>
}

type Deps = Dependencies<{
  logService: LogService
  timerHelpers: TimerHelpers
  commandStore: CommandStore
  commandHelpers: CommandHelpers
  chatStore: ChatStore
  linkCommand: LinkCommand
}>

export default class CommandService extends ContextClass {
  public readonly name = CommandService.name

  private readonly logService: LogService
  private readonly timerHelpers: TimerHelpers
  private readonly commandStore: CommandStore
  private readonly commandHelpers: CommandHelpers
  private readonly chatStore: ChatStore

  private readonly commands: ICommand[]

  private semaphore: Semaphore = new Semaphore(1, null)

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.commandStore = deps.resolve('commandStore')
    this.commandHelpers = deps.resolve('commandHelpers')
    this.chatStore = deps.resolve('chatStore')
    this.commands = [
      deps.resolve('linkCommand')
    ]
  }

  // because commands perform side effects and may be long-running tasks, we always defer execution to a later point in time
  public queueCommandExecution (commandId: number): void {
    // give some time for the caller to finish to minimise performance impact
    this.timerHelpers.setTimeout(async () => await this.executeCommandSafe(commandId), 500)
  }

  /** This method never throws. */
  private async executeCommandSafe (commandId: number): Promise<any> {
    await this.semaphore.enter()
    try {
      await this.commandStore.executionStarted(commandId)
      const result = await this.executeCommand(commandId)
      await this.commandStore.executionFinished(commandId, result ?? 'Success')
    } catch (e: any) {
      this.logService.logError(this, 'Encountered error while executing command', commandId, e)
      await this.saveErrorSafe(commandId, e)
    } finally {
      this.semaphore.exit()
    }
  }

  /** This method never throws. */
  private async saveErrorSafe (commandId: number, error: any) {
    try {
      await this.commandStore.executionFailed(commandId, error.message ?? 'Unknown error')
    } catch (innerError: any) {
      this.logService.logError(this, 'Failed to save error of command', commandId, innerError)
    }
  }

  /** Possibly long-running task to execute the specified command. Returns the result of executing the command, if any. Awaiting this method guarantees that the command has run to completion.
   * @throws {@link UnknownCommandError}: When the specified command does not exist.
   * @throws {@link InvalidCommandArgumentsError}: When the arguments provided to the command are invalid.
  */
  private async executeCommand (commandId: number): Promise<string | null> {
    const chatCommand = await this.commandStore.getCommand(commandId)
    const message = await this.chatStore.getChatById(chatCommand.chatMessageId)

    if (message.userId == null) {
      throw new Error('Chat command message must have a chat user attached to it')
    }

    const command = this.commands.find(c => c.normalisedNames.includes(chatCommand.normalisedCommandName))
    if (command == null) {
      throw new UnknownCommandError(chatCommand.normalisedCommandName)
    }

    const args = this.commandHelpers.getCommandArguments(message.chatMessageParts)
    return await command.executeCommand(message.userId, args)
  }
}
