import { ChatItemWithRelations, PartialChatMessage } from '@rebel/server/models/chat'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import { InvalidCommandArgumentsError } from '@rebel/server/util/error'
import { nameof, cast } from '@rebel/server/_test/utils'

let commandHelpers: CommandHelpers

beforeEach(() => {
  commandHelpers = new CommandHelpers()
})

describe(nameof(CommandHelpers, 'extractNormalisedCommand'), () => {
  test('Returns null if the parts include a non-text part', () => {
    const parts = cast<PartialChatMessage[]>([{ type: 'text' }, { type: 'customEmoji' }])

    const result = commandHelpers.extractNormalisedCommand(parts)

    expect(result).toBeNull()
  })

  test('Returns the normalised command name', () => {
    const parts = cast<PartialChatMessage[]>([{ type: 'text', text: ' !test 123 ' }])

    const result = commandHelpers.extractNormalisedCommand(parts)

    expect(result!.normalisedName).toBe('TEST')
  })
})

describe(nameof(CommandHelpers, 'getCommandArguments'), () => {
  test(`Throws ${InvalidCommandArgumentsError.name} if the parts include a non-text part`, () => {
    const parts = cast<ChatItemWithRelations['chatMessageParts']>([{ text: {} }, { customEmoji: {} }])

    expect(() => commandHelpers.getCommandArguments(parts)).toThrowError(InvalidCommandArgumentsError)
  })

  test('todo', () => {
    
  })
})