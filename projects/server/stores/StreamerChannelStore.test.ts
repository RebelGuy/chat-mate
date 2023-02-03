import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObjectDeep, nameof } from '@rebel/server/_test/utils'

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

  describe(nameof(StreamerChannelStore, 'deleteStreamerYoutubeChannelLink'), () => {
    test('Returns the channel that was removed', async () => {
      const youtubeId1 = 'id1'
      const youtubeId2 = 'id2'
      await db.streamerYoutubeChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }} }},
        youtubeChannel: { create: { user: { create: {}}, youtubeId: youtubeId1, infoHistory: { create: createYoutubeInfoHistory() }}}
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        youtubeChannel: { create: { user: { create: {}}, youtubeId: youtubeId2, infoHistory: { create: createYoutubeInfoHistory() }}}
      }})

      const result = await streamerChannelStore.deleteStreamerYoutubeChannelLink(1)

      await expectRowCount(db.streamerYoutubeChannelLink).toBe(1)
      expect(result!.platformInfo.channel.youtubeId).toBe(youtubeId1)
    })

    test('Returns null if no channel was removed', async () => {
      const youtubeId1 = 'id1'
      const youtubeId2 = 'id2'
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
      await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: youtubeId1, infoHistory: { create: createYoutubeInfoHistory() }}})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        youtubeChannel: { create: { user: { create: {}}, youtubeId: youtubeId2, infoHistory: { create: createYoutubeInfoHistory() }}}
      }})

      const result = await streamerChannelStore.deleteStreamerYoutubeChannelLink(1)

      await expectRowCount(db.streamerYoutubeChannelLink).toBe(1)
      expect(result).toBeNull()
    })
  })

  describe(nameof(StreamerChannelStore, 'deleteStreamerTwitchChannelLink'), () => {
    test('Returns the channel that was removed', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      await db.streamerTwitchChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }} }},
        twitchChannel: { create: { user: { create: {}}, twitchId: twitchId1, infoHistory: { create: createTwitchInfoHistory() }}}
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        twitchChannel: { create: { user: { create: {}}, twitchId: twitchId2, infoHistory: { create: createTwitchInfoHistory() }}}
      }})

      const result = await streamerChannelStore.deleteStreamerTwitchChannelLink(1)

      await expectRowCount(db.streamerTwitchChannelLink).toBe(1)
      expect(result!.platformInfo.channel.twitchId).toBe(twitchId1)
    })

    test('Returns null if no channel was removed', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: twitchId1, infoHistory: { create: createTwitchInfoHistory() }}})
      await db.streamerTwitchChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        twitchChannel: { create: { user: { create: {}}, twitchId: twitchId2, infoHistory: { create: createTwitchInfoHistory() }}}
      }})

      const result = await streamerChannelStore.deleteStreamerTwitchChannelLink(1)

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
      const streamer1 = 1
      const streamer2 = 2
      const streamer3 = 3

      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }} }})
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }})
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user3', hashedPassword: 'pass3', aggregateChatUser: { create: {}} }} }})
      // streamer 1: youtubeId1, twitchId1
      // streamer 2: youtubeId2
      // streamer 3: twitchId2
      await db.streamerYoutubeChannelLink.create({ data: {
        streamer: { connect: { id: streamer1 }},
        youtubeChannel: { create: { user: { create: {}}, youtubeId: youtubeId1, infoHistory: { create: createYoutubeInfoHistory() }}}
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamer: { connect: { id: streamer2 }},
        youtubeChannel: { create: { user: { create: {}}, youtubeId: youtubeId2, infoHistory: { create: createYoutubeInfoHistory() }}}
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamer: { connect: { id: streamer1 }},
        twitchChannel: { create: { user: { create: {}}, twitchId: twitchId1, infoHistory: { create: createTwitchInfoHistory() }}}
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamer: { connect: { id: streamer3 }},
        twitchChannel: { create: { user: { create: {}}, twitchId: twitchId2, infoHistory: { create: createTwitchInfoHistory() }}}
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
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
      await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: youtubeId1, infoHistory: { create: createYoutubeInfoHistory() }}})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        youtubeChannel: { create: { user: { create: {}}, youtubeId: youtubeId2, infoHistory: { create: createYoutubeInfoHistory() }}}
      }})

      const result = await streamerChannelStore.setStreamerYoutubeChannelLink(1, 1)

      await expectRowCount(db.streamerYoutubeChannelLink).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, { platformInfo: { channel: { youtubeId: youtubeId1 }}}))
    })

    test('Throws if a primary channel already exists for the streamer', async () => {
      const youtubeId1 = 'id1'
      const youtubeId2 = 'id2'
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
      await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: youtubeId1, infoHistory: { create: createYoutubeInfoHistory() }}})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        youtubeChannel: { create: { user: { create: {}}, youtubeId: youtubeId2, infoHistory: { create: createYoutubeInfoHistory() }}}
      }})

      await expect(() => streamerChannelStore.setStreamerYoutubeChannelLink(2, 1)).rejects.toThrow()
    })
  })

  describe(nameof(StreamerChannelStore, 'setStreamerTwitchChannelLink'), () => {
    test('Adds the primary channel', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: twitchId1, infoHistory: { create: createTwitchInfoHistory() }}})
      await db.streamerTwitchChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        twitchChannel: { create: { user: { create: {}}, twitchId: twitchId2, infoHistory: { create: createTwitchInfoHistory() }}}
      }})

      const result = await streamerChannelStore.setStreamerTwitchChannelLink(1, 1)

      await expectRowCount(db.streamerTwitchChannelLink).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, { platformInfo: { channel: { twitchId: twitchId1 }}}))
    })

    test('Throws if a primary channel already exists for the streamer', async () => {
      const twitchId1 = 'id1'
      const twitchId2 = 'id2'
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: twitchId1, infoHistory: { create: createTwitchInfoHistory() }}})
      await db.streamerTwitchChannelLink.create({ data: {
        streamer: { create: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }} }},
        twitchChannel: { create: { user: { create: {}}, twitchId: twitchId2, infoHistory: { create: createTwitchInfoHistory() }}}
      }})

      await expect(() => streamerChannelStore.setStreamerTwitchChannelLink(2, 1)).rejects.toThrow()
    })
  })
}

function createYoutubeInfoHistory () {
  return { imageUrl: '', isModerator: false, isOwner: false, isVerified: false, name: 'channel', time: new Date() }
}

function createTwitchInfoHistory () {
  return { colour: '', displayName: '', isBroadcaster: false, isMod: false, isSubscriber: false, isVip: false, time: new Date(), userName: '', userType: '' }
}
