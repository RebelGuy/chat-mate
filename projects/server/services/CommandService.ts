import { ChatMessagePart } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import { ChatItem, ChatItemWithRelations, PartialChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import LinkService from '@rebel/server/services/LinkService'
import LogService from '@rebel/server/services/LogService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import CommandStore from '@rebel/server/stores/CommandStore'
import { InvalidCommandArgumentsError, UnknownCommandError } from '@rebel/server/util/error'
import Semaphore from '@rebel/server/util/Semaphore'

export type NormalisedCommand = {
  normalisedName: string
}

type Deps = Dependencies<{
  logService: LogService
  timerHelpers: TimerHelpers
  commandStore: CommandStore
  linkService: LinkService
  chatStore: ChatStore
}>

export default class CommandService extends ContextClass {
  public readonly name = CommandService.name

  private readonly logService: LogService
  private readonly timerHelpers: TimerHelpers
  private readonly commandStore: CommandStore
  private readonly linkService: LinkService
  private readonly chatStore: ChatStore

  private semaphore: Semaphore = new Semaphore(1, null)

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.commandStore = deps.resolve('commandStore')
    this.linkService = deps.resolve('linkService')
    this.chatStore = deps.resolve('chatStore')
  }

  public extractNormalisedCommand (parts: PartialChatMessage[]): NormalisedCommand | null {
    if (parts.length === 0 || parts[0].type !== 'text') {
      return null
    }

    const startText = parts[0].text.trim().split(' ')[0]
    if (startText.startsWith('!')) {
      return {
        normalisedName: startText.substring(1).toUpperCase()
      }
    } else {
      return null
    }
  }

  // because commands perform side effects and may be long-running tasks, we always defer execution to a later point in time
  public queueCommandExecution (commandId: number): void {
    // give some time for the caller to finish to minimise performance impact
    this.timerHelpers.setTimeout(async () => await this.executeCommandSafe(commandId), 500)
  }

  private async executeCommandSafe (commandId: number): Promise<any> {
    await this.semaphore.enter()
    try {
      this.commandStore.executionStarted(commandId)
      const result = await this.executeCommand(commandId)
      this.commandStore.executionFinished(commandId, result ?? '')
    } catch (e: any) {
      this.logService.logError(this, 'Encountered error while executing command', commandId, e)
      await this.saveErrorSafe(commandId, e)
    } finally {
      this.semaphore.exit()
    }
  }

  private async saveErrorSafe (commandId: number, error: any) {
    try {
      await this.commandStore.executionFailed(commandId, error.message ?? '')
    } catch (innerError: any) {
      this.logService.logError(this, 'Failed to save error of command', commandId, innerError)
    }
  }

  /** Possibly long-running task to execute the specified command. Returns the result of executing the command, if any. Awaiting this method guarantees that the command has run to completion.
   * @throws {@link UnknownCommandError}: When the specified command does not exist.
   * @throws {@link InvalidCommandArgumentsError}: When the arguments provided to the command are invalid.
  */
  private async executeCommand (commandId: number): Promise<string | null> {
    const command = await this.commandStore.getCommand(commandId)
    const message = await this.chatStore.getChatById(command.chatMessageId)

    if (message.userId == null) {
      throw new Error('Chat command message must have a chat user attached to them')
    }

    const args = getArguments(message)

    if (command.normalisedCommandName === 'LINK') {
      return await this.executeLinkCommand(message.userId, args)
    } else {
      throw new UnknownCommandError(command.normalisedCommandName)
    }
  }

  private async executeLinkCommand (defaultUserId: number, args: string[]): Promise<string | null> {
    if (args.length !== 1) {
      throw new InvalidCommandArgumentsError(`Expected 1 argument but received ${args.length}`)
    }

    const linkToken = args[0]
    const aggregateUserId = 1 // todo: get from link token. may have to get registered user, then its aggregate user id
    await this.linkService.linkUser(defaultUserId, aggregateUserId)
    return `Successfully linked user ${defaultUserId} to ${aggregateUserId}`
  }
}

function getArguments (message: ChatItemWithRelations): string[] {
  if (message.chatMessageParts.find(p => p.text == null) != null) {
    throw new InvalidCommandArgumentsError('Cannot parse arguments of a chat message that contains non-text parts')
  }

  const flattened = message.chatMessageParts.map(p => p.text!.text).join().trim()
  const parts = flattened.split(' ').filter(p => p.length > 0)
  if (!parts[0].startsWith('!')) {
    throw new Error('Invalid command format - must start with `!`')
  }

  return parts.slice(1)
}
