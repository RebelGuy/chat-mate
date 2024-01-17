import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { DbError } from '@rebel/shared/util/error'
import * as data from '@rebel/server/_test/testData'

export default () => {
  const username1 = 'username1'
  const username2 = 'username2'

  let db: Db
  let streamerChannelStore: StreamerChannelStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    streamerChannelStore = new StreamerChannelStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(StreamerChannelStore, 'removeStreamerYoutubeChannelLink'), () => {
    test('Returns the channel that was removed', async () => {
      const youtubeId1 = 'id1'
      const youtubeId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createYoutubeChannels(youtubeId1, youtubeId2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer1,
        youtubeChannelId: 1,
        timeAdded: data.time1
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: 2,
        timeAdded: data.time2
      }})

      const result = await streamerChannelStore.removeStreamerYoutubeChannelLink(1)

      await expectRowCount(db.streamerYoutubeChannelLink).toBe(1)
      expect(result!.platformInfo.channel.youtubeId).toBe(youtubeId1)
    })

    test('Returns null if no channel was removed', async () => {
      const youtubeId1 = 'id1'
      const youtubeId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createYoutubeChannels(youtubeId1, youtubeId2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: 2,
        timeAdded: data.time2
      }})

      const result = await streamerChannelStore.removeStreamerYoutubeChannelLink(1)

      await expectRowCount(db.streamerYoutubeChannelLink).toBe(1)
      expect(result).toBeNull()
    })
  })

  describe(nameof(StreamerChannelStore, 'removeStreamerTwitchChannelLink'), () => {
    test('Returns the channel that was removed', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createTwitchChannels(twitchId1, twitchId2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer1,
        twitchChannelId: 1,
        timeAdded: data.time1
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: 2,
        timeAdded: data.time2
      }})

      const result = await streamerChannelStore.removeStreamerTwitchChannelLink(1)

      await expectRowCount(db.streamerTwitchChannelLink).toBe(1)
      expect(result!.platformInfo.channel.twitchId).toBe(twitchId1)
    })

    test('Returns null if no channel was removed', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createTwitchChannels(twitchId1, twitchId2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: 2,
        timeAdded: data.time1
      }})

      const result = await streamerChannelStore.removeStreamerTwitchChannelLink(1)

      await expectRowCount(db.streamerTwitchChannelLink).toBe(1)
      expect(result).toBeNull()
    })
  })

  describe(nameof(StreamerChannelStore, 'getPrimaryChannels'), () => {
    test('Returns the primary channels of the queried streamers', async () => {
      const youtubeId1 = 'youtubeId1'
      const youtubeId2 = 'youtubeId2'
      const twitchId1 = 'twitchId1'
      const twitchId2 = 'twitchId2'

      const [streamer1, streamer2, streamer3] = await createStreamers(3)
      await createYoutubeChannels(youtubeId1, youtubeId2)
      await createTwitchChannels(twitchId1, twitchId2)

      // streamer 1: youtubeId1, twitchId1
      // streamer 2: youtubeId2
      // streamer 3: twitchId2
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer1,
        youtubeChannelId: 1,
        timeAdded: data.time1
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: 2,
        timeAdded: data.time2
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer1,
        twitchChannelId: 1,
        timeAdded: data.time3
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer3,
        twitchChannelId: 2,
        timeAdded: data.time3
      }})

      const primaryChannels = await streamerChannelStore.getPrimaryChannels([streamer1, streamer2])

      expect(primaryChannels).toEqual(expectObjectDeep(primaryChannels, [
        { streamerId: streamer1, youtubeChannel: { platformInfo: { channel: { youtubeId: youtubeId1 }}}, twitchChannel: { platformInfo: { channel: { twitchId: twitchId1 }}}},
        { streamerId: streamer2, youtubeChannel: { platformInfo: { channel: { youtubeId: youtubeId2 }}}, twitchChannel: null},
      ]))
    })
  })

  describe(nameof(StreamerChannelStore, 'setStreamerYoutubeChannelLink'), () => {
    test('Adds the primary channel', async () => {
      const youtubeId1 = 'id1'
      const youtubeId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createYoutubeChannels(youtubeId1, youtubeId2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: 2,
        timeAdded: data.time1
      }})

      const result = await streamerChannelStore.setStreamerYoutubeChannelLink(1, 1)

      await expectRowCount(db.streamerYoutubeChannelLink).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, { platformInfo: { channel: { youtubeId: youtubeId1 }}}))
    })

    test('Throws if a primary channel already exists for the streamer', async () => {
      const youtubeId1 = 'id1'
      const youtubeId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createYoutubeChannels(youtubeId1, youtubeId2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: 2,
        timeAdded: data.time1
      }})

      await expect(() => streamerChannelStore.setStreamerYoutubeChannelLink(2, 1)).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(StreamerChannelStore, 'setStreamerTwitchChannelLink'), () => {
    test('Adds the primary channel', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createTwitchChannels(twitchId1, twitchId2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: 2,
        timeAdded: data.time1
      }})

      const result = await streamerChannelStore.setStreamerTwitchChannelLink(1, 1)

      await expectRowCount(db.streamerTwitchChannelLink).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, { platformInfo: { channel: { twitchId: twitchId1 }}}))
    })

    test('Throws if a primary channel already exists for the streamer', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      const [streamer1, streamer2] = await createStreamers(2)
      await createTwitchChannels(twitchId1, twitchId2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: 2,
        timeAdded: data.time1
      }})

      await expect(() => streamerChannelStore.setStreamerTwitchChannelLink(2, 1)).rejects.toThrowError(DbError)
    })
  })

  async function createStreamers (count: number = 1) {
    return await Promise.all(Array(count).map((_, i) => db.streamer.create({ data: { registeredUser: { create: { username: `user${i}`, hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})))
      .then(streamers => streamers.map(s => s.id))
  }

  async function createYoutubeChannels (...youtubeIds: string[]) {
    return await Promise.all(youtubeIds.map(youtubeId => db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId, globalInfoHistory: { create: createYoutubeInfoHistory() }}})))
  }

  async function createTwitchChannels (...twitchIds: string[]) {
    return await Promise.all(twitchIds.map(twitchId => db.twitchChannel.create({ data: { user: { create: {}}, twitchId, globalInfoHistory: { create: createTwitchInfoHistory() }}})))
  }
}

function createYoutubeInfoHistory () {
  return { imageUrl: '', isVerified: false, name: 'channel', time: new Date() }
}

function createTwitchInfoHistory () {
  return { colour: '', displayName: '', time: new Date(), userName: '', userType: '' }
}
