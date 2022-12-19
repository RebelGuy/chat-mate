import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItemWithRelations, PartialChatMessage } from '@rebel/server/models/chat'
import { NormalisedCommand } from '@rebel/server/services/command/CommandService'
import { InvalidCommandArgumentsError } from '@rebel/server/util/error'

export default class CommandHelpers extends ContextClass {
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

  /**  @throws {@link InvalidCommandArgumentsError}: When the arguments provided to the command are invalid. */
  public getCommandArguments (messageParts: ChatItemWithRelations['chatMessageParts']): string[] {
    if (messageParts.find(p => p.text == null) != null) {
      throw new InvalidCommandArgumentsError('Cannot parse arguments of a chat message that contains non-text parts')
    }

    const flattened = messageParts.map(p => p.text!.text).join().trim()
    const stringParts = flattened.split(' ').filter(p => p.length > 0)
    if (!stringParts[0].startsWith('!')) {
      throw new Error('Invalid command format - must start with `!`')
    }

    return stringParts.slice(1)
  }
}
