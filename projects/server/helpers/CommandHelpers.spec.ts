import { ChatItemWithRelations, PartialChatMessage } from '@rebel/server/models/chat'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import { InvalidCommandArgumentsError } from '@rebel/shared/util/error'
import { nameof, cast } from '@rebel/shared/testUtils'

let commandHelpers: CommandHelpers

beforeEach(() => {
  commandHelpers = new CommandHelpers()
})

describe(nameof(CommandHelpers, 'extractNormalisedCommand'), () => {
  test('Returns null if the first part is a non-text part', () => {
    const parts = cast<PartialChatMessage[]>([{ type: 'customEmoji' }, { type: 'text' }])

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

  test('Returns an empty array if there are no non-empty arguments', () => {
    const text = ' !test-command   '
    const parts = cast<ChatItemWithRelations['chatMessageParts']>([{ text: { text } }])

    const result = commandHelpers.getCommandArguments(parts)

    expect(result).toEqual([])
  })

  test('Returns an the array of arguments passed to the command', () => {
    const text = ' !test-command arg1 arg2  arg3 '
    const parts = cast<ChatItemWithRelations['chatMessageParts']>([{ text: { text } }])

    const result = commandHelpers.getCommandArguments(parts)

    expect(result).toEqual(['arg1', 'arg2', 'arg3'])
  })
})
