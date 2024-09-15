import { startTestDb, DB_TEST_TIMEOUT, stopTestDb } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import LiveReactionStore from '@rebel/server/stores/LiveReactionStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import * as data from '@rebel/server/_test/testData'

export default () => {
  let liveReactionStore: LiveReactionStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    liveReactionStore = new LiveReactionStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(LiveReactionStore, 'addLiveReaction'), () => {
    test('Adds the live reaction records to the db', async () => {
      await db.chatUser.createMany({ data: [{}, {}]})

      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'test', aggregateChatUserId: 1 }} } })
      const streamer = await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'test', aggregateChatUserId: 2 }} } })

      await db.chatEmoji.create({ data: { imageUrl: '1', isCustomEmoji: false, image: { create: { url: '1', width: 1, height: 1, fingerprint: '1' }}}})
      const emoji = await db.chatEmoji.create({ data: { imageUrl: '2', isCustomEmoji: false, image: { create: { url: '2', width: 1, height: 1, fingerprint: '2' }}}})

      const reactionCount = 5

      await liveReactionStore.addLiveReaction(streamer.id, emoji.id, reactionCount)

      const storedData = await db.liveReaction.findMany().then(single)
      expect(storedData).toEqual<typeof storedData>({
        id: 1,
        emojiId: emoji.id,
        streamerId: streamer.id,
        count: reactionCount,
        time: expect.any(Date)
      })
    })
  })

  describe(nameof(LiveReactionStore, 'getTotalLiveReactions'), () => {
    test('Gets the correct number of reactions', async () => {
      await db.chatUser.createMany({ data: [{}, {}]})

      const streamer1 = await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'test', aggregateChatUserId: 1 }} } })
      const streamer2 = await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'test', aggregateChatUserId: 2 }} } })

      const emoji1 = await db.chatEmoji.create({ data: { imageUrl: '1', isCustomEmoji: false, image: { create: { url: '1', width: 1, height: 1, fingerprint: '1' }}}})
      const emoji2 = await db.chatEmoji.create({ data: { imageUrl: '2', isCustomEmoji: false, image: { create: { url: '2', width: 1, height: 1, fingerprint: '2' }}}})

      const count1 = 5
      const count2 = 1

      await db.liveReaction.createMany({ data: [
        { streamerId: streamer1.id, emojiId: emoji1.id, count: count1 },
        { streamerId: streamer2.id, emojiId: emoji2.id, count: count2 },
      ]})

      const result = await liveReactionStore.getTotalLiveReactions(0)

      const expectedCount = count1 + count2
      expect(result).toEqual(expectedCount)
    })

    test('Gets the correct number of reactions', async () => {
      const streamer1 = await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'test', aggregateChatUser: { create: {}} }} } })
      const emoji1 = await db.chatEmoji.create({ data: { imageUrl: '1', isCustomEmoji: false, image: { create: { url: '1', width: 1, height: 1, fingerprint: '1' }}}})

      const count1 = 5
      const count2 = 2

      await db.liveReaction.createMany({ data: [
        { streamerId: streamer1.id, emojiId: emoji1.id, count: count1, time: data.time1 },
        { streamerId: streamer1.id, emojiId: emoji1.id, count: count2, time: data.time3 },
      ]})

      const result = await liveReactionStore.getTotalLiveReactions(data.time2.getTime())

      expect(result).toEqual(count2)
    })
  })
}
