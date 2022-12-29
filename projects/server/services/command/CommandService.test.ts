import { Dependencies } from '@rebel/server/context/context'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import CommandService, { CommandData } from '@rebel/server/services/command/CommandService'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import LinkService from '@rebel/server/services/LinkService'
import ChatStore from '@rebel/server/stores/ChatStore'
import CommandStore from '@rebel/server/stores/CommandStore'
import { mock, MockProxy } from 'jest-mock-extended'
import { cast, expectArray, expectObject } from '@rebel/server/_test/utils'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import { ChatCommand, ChatMessage } from '@prisma/client'
import { sleep } from '@rebel/server/util/node'

let mockTimerHelpers: MockProxy<TimerHelpers>
let mockCommandStore: MockProxy<CommandStore>
let mockLinksService: MockProxy<LinkService>
let mockChatStore: MockProxy<ChatStore>
let mockCommandHelpers: MockProxy<CommandHelpers>
let mockLinkCommand: MockProxy<LinkCommand>
let commandService: CommandService

beforeEach(() => {
  mockTimerHelpers = mock()
  mockCommandStore = mock()
  mockLinksService = mock()
  mockChatStore = mock()
  mockCommandHelpers = mock()
  mockLinkCommand = mock<LinkCommand>({ normalisedNames: ['LINK'] })

  commandService = new CommandService(new Dependencies({
    logService: mock(),
    timerHelpers: mockTimerHelpers,
    commandStore: mockCommandStore,
    linkService: mockLinksService,
    chatStore: mockChatStore,
    commandHelpers: mockCommandHelpers,
    linkCommand: mockLinkCommand
  }))
})

// 'tis a bit hard to follow, i guess. do i care?                                                                    nope
describe('Integration tests', () => {
  test('Commands are run one at a time and the result is saved to the CommandStore', async () => {
    const commandId1 = 2
    const commandId2 = 3
    const commandId3 = 4
    const defaultUser1 = 556
    const defaultUser2 = 5564
    const defaultUser3 = 5564
    const args1: string[] = []
    const args2: string[] = []
    const args3: string[] = []

    // set up commands
    let resolve1: (result: string) => void
    let reject2: (err: any) => void
    let resolve3: (result: string) => void
    let command1Started = false
    let command2Started = false
    let command3Started = false
    const command1 = () => new Promise<string>(res => { resolve1 = res, command1Started = true })
    const command2 = () => new Promise<string>((_, rej) => { reject2 = rej, command2Started = true })
    const command3 = () => new Promise<string>(res => { resolve3 = res, command3Started = true })
    mockLinkCommand.executeCommand.calledWith(defaultUser1, args1).mockImplementation(command1)
    mockLinkCommand.executeCommand.calledWith(defaultUser2, args2).mockImplementation(command2)
    mockLinkCommand.executeCommand.calledWith(defaultUser3, args3).mockImplementation(command3)

    // set up mocks
    const chatMessage1 = cast<ChatItemWithRelations>({ id: 5, chatMessageParts: [], userId: defaultUser1 })
    const chatMessage2 = cast<ChatItemWithRelations>({ id: 6, chatMessageParts: [], userId: defaultUser2 })
    const chatMessage3 = cast<ChatItemWithRelations>({ id: 7, chatMessageParts: [], userId: defaultUser3 })
    mockCommandStore.getCommand.calledWith(commandId1)
      .mockResolvedValue(cast<ChatCommand & { chatMessage: ChatMessage }>({ chatMessageId: chatMessage1.id, normalisedCommandName: 'LINK' }))
    mockCommandStore.getCommand.calledWith(commandId2)
      .mockResolvedValue(cast<ChatCommand & { chatMessage: ChatMessage }>({ chatMessageId: chatMessage2.id, normalisedCommandName: 'LINK' }))
    mockCommandStore.getCommand.calledWith(commandId3)
      .mockResolvedValue(cast<ChatCommand & { chatMessage: ChatMessage }>({ chatMessageId: chatMessage3.id, normalisedCommandName: 'LINK' }))
    mockChatStore.getChatById.calledWith(chatMessage1.id).mockResolvedValue(chatMessage1)
    mockChatStore.getChatById.calledWith(chatMessage2.id).mockResolvedValue(chatMessage2)
    mockChatStore.getChatById.calledWith(chatMessage3.id).mockResolvedValue(chatMessage3)

    mockCommandHelpers.getCommandArguments.calledWith(chatMessage1.chatMessageParts).mockReturnValue(args1)
    mockCommandHelpers.getCommandArguments.calledWith(chatMessage2.chatMessageParts).mockReturnValue(args2)
    mockCommandHelpers.getCommandArguments.calledWith(chatMessage3.chatMessageParts).mockReturnValue(args3)

    // ensure our initial state is correct
    expect(commandService.getRunningCommand()).toBeNull()
    expect(commandService.getQueuedCommands().length).toBe(0)

    // act
    commandService.queueCommandExecution(commandId1)
    commandService.queueCommandExecution(commandId2)
    commandService.queueCommandExecution(commandId3)

    // execute the timed out callbacks now - they are deliberately NOT awaited here to simulate the real-life behaviour
    mockTimerHelpers.setTimeout.mock.calls.forEach(args => args[0]())
    await sleep(0) // push the test task to the end of the event loop queue

    // at this point, we should still be waiting for the first command to resolve
    expect(command1Started).toBe(true)
    expect(command2Started).toBe(false)
    expect(command3Started).toBe(false)

    // do a full check of the state (later on, we will check again but taking some shortcuts as we have verified here that the data is complete)
    expect(commandService.getRunningCommand()).toEqual(expectObject<CommandData>({ commandId: commandId1, arguments: args1, normalisedName: 'LINK', userId: defaultUser1 }))
    expect(commandService.getQueuedCommands().length).toBe(2)
    expect(commandService.getQueuedCommands()).toEqual(expectArray<CommandData>([
      { commandId: commandId2, arguments: args2, normalisedName: 'LINK', userId: defaultUser2 },
      { commandId: commandId3, arguments: args3, normalisedName: 'LINK', userId: defaultUser3 }
    ]))

    resolve1!('success 1') // finish the first command

    await sleep(0)

    expect(command2Started).toBe(true)
    expect(command3Started).toBe(false)
    expect(commandService.getRunningCommand()!.commandId).toBe(commandId2)
    expect(commandService.getQueuedCommands().length).toBe(1)

    reject2!(new Error('failure 2')) // finish the second command

    await sleep(0)

    expect(command3Started).toBe(true)
    expect(commandService.getRunningCommand()!.commandId).toBe(commandId3)
    expect(commandService.getQueuedCommands().length).toBe(0)

    resolve3!('success 3') // finish the third command

    await sleep(0) // let the command service run to completion before finishing the test

    expect(mockCommandStore.executionFinished.mock.calls).toEqual([[commandId1, 'success 1'], [commandId3, 'success 3']])
    expect(mockCommandStore.executionFailed.mock.calls).toEqual([[commandId2, 'failure 2']])

    // state should be cleaned up
    expect(commandService.getRunningCommand()).toBeNull()
    expect(commandService.getQueuedCommands().length).toBe(0)
  })
})
