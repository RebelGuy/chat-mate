import { ChatCommand, ChatMessage } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import CommandStore from '@rebel/server/stores/CommandStore'
import { randomString } from '@rebel/server/util/random'
import { DB_TEST_TIMEOUT, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'

export default () => {
  let chatMessage: ChatMessage

  let db: Db
  let commandStore: CommandStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    commandStore = new CommandStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()

    chatMessage = await db.chatMessage.create({ data: {
      externalId: '',
      time: new Date(),
      streamer: { create: {
        registeredUser: { create: {
          username: 'test',
          hashedPassword: 'test',
          aggregateChatUser: { create: {}}
        }}
      }}
    }})
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(CommandStore, 'addCommand'), () => {
    test('Adds the command', async () => {
      const normalisedName = 'test'

      const result = await commandStore.addCommand(1, { normalisedName })

      expect(result).toBe(1)
      expect(await db.chatCommand.findFirst()).toEqual(expectObject<ChatCommand>({ normalisedCommandName: normalisedName, startTime: null, chatMessageId: 1 }))
    })
  })

  describe(nameof(CommandStore, 'executionStarted'), () => {
    test('Sets the start time of the command object', async () => {
      await db.chatCommand.create({ data: { normalisedCommandName: 'test', chatMessageId: chatMessage.id }})

      await commandStore.executionStarted(1)

      expect(await db.chatCommand.findFirst()).toEqual(expectObject<ChatCommand>({ startTime: expect.any(Date), endTime: null }))
    })
  })

  describe(nameof(CommandStore, 'executionFinished'), () => {
    test('Sets the end time and trimmed result of the command object', async () => {
      await db.chatCommand.create({ data: { normalisedCommandName: 'test', chatMessageId: chatMessage.id, startTime: new Date() }})
      const result = randomString(1500)

      await commandStore.executionFinished(1, result)

      const stored = await db.chatCommand.findFirst()
      expect(stored).toEqual(expectObject<ChatCommand>({ endTime: expect.any(Date), error: null }))
      expect(result.startsWith(stored!.error!)).toBe(true)
    })
  })

  describe(nameof(CommandStore, 'executionFailed'), () => {
    test('Sets the end time and trimmed error of the command object', async () => {
      await db.chatCommand.create({ data: { normalisedCommandName: 'test', chatMessageId: chatMessage.id, startTime: new Date() }})
      const error = randomString(1500)

      await commandStore.executionFailed(1, error)

      const stored = await db.chatCommand.findFirst()
      expect(stored).toEqual(expectObject<ChatCommand>({ endTime: expect.any(Date), result: null }))
      expect(error.startsWith(stored!.error!)).toBe(true)
    })
  })

  describe(nameof(CommandStore, 'getCommand'), () => {
    test('Returns the chat command object', async () => {
      const command = await db.chatCommand.create({ data: { normalisedCommandName: 'test', chatMessageId: chatMessage.id }})

      const result = await commandStore.getCommand(1)

      expect(result).toEqual(expectObject<ChatCommand & { chatMessage: ChatMessage }>({ ...command, ...chatMessage }))
    })
  })
}
