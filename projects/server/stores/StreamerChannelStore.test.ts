import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { PrimaryChannelAlreadyExistsError, PrimaryChannelNotFoundError } from '@rebel/shared/util/error'
import * as data from '@rebel/server/_test/testData'
import { TwitchChannel, YoutubeChannel } from '@prisma/client'

export default () => {
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
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createYoutubeChannels(2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer1,
        youtubeChannelId: channel1.id,
        timeAdded: data.time1,
        timeRemoved: data.time2
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer1,
        youtubeChannelId: channel1.id,
        timeAdded: data.time2
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: channel2.id,
        timeAdded: data.time2
      }})

      const result = await streamerChannelStore.removeStreamerYoutubeChannelLink(streamer1)

      const storedLinks = await db.streamerYoutubeChannelLink.findMany()
      expect(storedLinks).toEqual(expectObject(storedLinks, [
        { id: 1, timeRemoved: data.time2 },
        { id: 2, timeRemoved: expect.any(Date) },
        { id: 3, timeRemoved: null }
      ]))
      expect(result!.platformInfo.channel.youtubeId).toBe(channel1.youtubeId)
    })

    test(`Throws ${PrimaryChannelNotFoundError.name} if no channel was removed`, async () => {
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createYoutubeChannels(2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer1,
        youtubeChannelId: channel1.id,
        timeAdded: data.time1,
        timeRemoved: data.time2
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: channel2.id,
        timeAdded: data.time2
      }})

      await expect(() => streamerChannelStore.removeStreamerYoutubeChannelLink(streamer1)).rejects.toThrowError(PrimaryChannelNotFoundError)

      const storedLinks = await db.streamerYoutubeChannelLink.findMany()
      expect(storedLinks).toEqual(expectObject(storedLinks, [
        { id: 1, timeRemoved: data.time2 },
        { id: 2, timeRemoved: null }
      ]))
    })
  })

  describe(nameof(StreamerChannelStore, 'removeStreamerTwitchChannelLink'), () => {
    test('Returns the channel that was removed', async () => {
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createTwitchChannels(2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer1,
        twitchChannelId: channel1.id,
        timeAdded: data.time1,
        timeRemoved: data.time2
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer1,
        twitchChannelId: channel1.id,
        timeAdded: data.time2
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: channel2.id,
        timeAdded: data.time2
      }})

      const result = await streamerChannelStore.removeStreamerTwitchChannelLink(1)

      const storedLinks = await db.streamerTwitchChannelLink.findMany()
      expect(storedLinks).toEqual(expectObject(storedLinks, [
        { id: 1, timeRemoved: data.time2 },
        { id: 2, timeRemoved: expect.any(Date) },
        { id: 3, timeRemoved: null }
      ]))
      expect(result!.platformInfo.channel.twitchId).toBe(channel1.twitchId)
    })

    test(`Throws ${PrimaryChannelNotFoundError.name} if no channel was removed`, async () => {
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createTwitchChannels(2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer1,
        twitchChannelId: channel1.id,
        timeAdded: data.time1,
        timeRemoved: data.time2
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: channel2.id,
        timeAdded: data.time1
      }})

      await expect(() => streamerChannelStore.removeStreamerTwitchChannelLink(streamer1)).rejects.toThrowError(PrimaryChannelNotFoundError)

      const storedLinks = await db.streamerTwitchChannelLink.findMany()
      expect(storedLinks).toEqual(expectObject(storedLinks, [
        { id: 1, timeRemoved: data.time2 },
        { id: 2, timeRemoved: null }
      ]))
    })
  })

  describe(nameof(StreamerChannelStore, 'getPrimaryChannels'), () => {
    test('Returns the primary channels of the queried streamers', async () => {
      const [streamer1, streamer2, streamer3] = await createStreamers(3)
      const [youtubeChannel1, youtubeChannel2] = await createYoutubeChannels(2)
      const [twitchChannel1, twitchChannel2] = await createTwitchChannels(2)

      // streamer 1: youtubeId1, twitchId1
      // streamer 2: youtubeId2
      // streamer 3: twitchId2
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer1,
        youtubeChannelId: youtubeChannel1.id,
        timeAdded: data.time1
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: youtubeChannel2.id,
        timeAdded: data.time2
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer1,
        twitchChannelId: twitchChannel1.id,
        timeAdded: data.time3
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: twitchChannel1.id,
        timeAdded: data.time4,
        timeRemoved: data.time5 // should be ignored because deactivated
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer3, // should be ignored because different streamer
        twitchChannelId: twitchChannel2.id,
        timeAdded: data.time4
      }})

      const primaryChannels = await streamerChannelStore.getPrimaryChannels([streamer1, streamer2])

      expect(primaryChannels).toEqual(expectObjectDeep(primaryChannels, [
        { streamerId: streamer1, youtubeChannel: { platformInfo: { channel: { youtubeId: youtubeChannel1.youtubeId }}}, youtubeChannelSince: data.time1.getTime(), twitchChannel: { platformInfo: { channel: { twitchId: twitchChannel1.twitchId }}}, twitchChannelSince: data.time3.getTime() },
        { streamerId: streamer2, youtubeChannel: { platformInfo: { channel: { youtubeId: youtubeChannel2.youtubeId }}}, youtubeChannelSince: data.time2.getTime(),  twitchChannel: null}
      ]))
    })
  })

  describe(nameof(StreamerChannelStore, 'setStreamerYoutubeChannelLink'), () => {
    test('Adds the primary channel', async () => {
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createYoutubeChannels(2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: channel2.id,
        timeAdded: data.time1
      }})
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer1, // should be ignored since it's deactivated
        youtubeChannelId: channel1.id,
        timeAdded: data.time1,
        timeRemoved: data.time2
      }})

      const result = await streamerChannelStore.setStreamerYoutubeChannelLink(streamer1, channel1.id)

      await expectRowCount(db.streamerYoutubeChannelLink).toBe(3)
      expect(result).toEqual(expectObjectDeep(result, { platformInfo: { channel: { youtubeId: channel1.youtubeId }}}))
    })

    test(`Throws ${PrimaryChannelAlreadyExistsError.name} if a primary channel already exists for the streamer`, async () => {
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createYoutubeChannels(2)
      await db.streamerYoutubeChannelLink.create({ data: {
        streamerId: streamer2,
        youtubeChannelId: channel2.id,
        timeAdded: data.time1
      }})

      await expect(() => streamerChannelStore.setStreamerYoutubeChannelLink(2, 1)).rejects.toThrowError(PrimaryChannelAlreadyExistsError)
      await expectRowCount(db.streamerYoutubeChannelLink).toBe(1)
    })
  })

  describe(nameof(StreamerChannelStore, 'setStreamerTwitchChannelLink'), () => {
    test('Adds the primary channel', async () => {
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createTwitchChannels(2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: channel2.id,
        timeAdded: data.time1
      }})
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer1, // should be ignored since it's deactivated
        twitchChannelId: channel1.id,
        timeAdded: data.time1,
        timeRemoved: data.time2
      }})

      const result = await streamerChannelStore.setStreamerTwitchChannelLink(streamer1, 1)

      await expectRowCount(db.streamerTwitchChannelLink).toBe(3)
      expect(result).toEqual(expectObjectDeep(result, { platformInfo: { channel: { twitchId: channel1.twitchId }}}))
    })

    test(`Throws ${PrimaryChannelAlreadyExistsError.name} if a primary channel already exists for the streamer`, async () => {
      const [streamer1, streamer2] = await createStreamers(2)
      const [channel1, channel2] = await createTwitchChannels(2)
      await db.streamerTwitchChannelLink.create({ data: {
        streamerId: streamer2,
        twitchChannelId: channel2.id,
        timeAdded: data.time1
      }})

      await expect(() => streamerChannelStore.setStreamerTwitchChannelLink(2, 1)).rejects.toThrowError(PrimaryChannelAlreadyExistsError)
      await expectRowCount(db.streamerTwitchChannelLink).toBe(1)
    })
  })

  async function createStreamers (count: number) {
    let result: number[] = []
    for (let i = 0; i < count; i++) {
      const streamer = await db.streamer.create({ data: { registeredUser: { create: { username: `user${i}`, hashedPassword: `pass${i}`, aggregateChatUser: { create: {}} }}}})
      result.push(streamer.id)
    }
    return result
  }

  async function createYoutubeChannels (count: number) {
    // required for the global info
    await db.image.create({ data: { fingerprint: '', width: 0, height: 0, url: '' }})

    let result: YoutubeChannel[] = []
    for (let i = 0; i < count; i++) {
      const youtubeChannel = await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: `id${i}`, globalInfoHistory: { create: createYoutubeInfoHistory() }}})
      result.push(youtubeChannel)
    }
    return result
  }

  async function createTwitchChannels (count: number) {
    let result: TwitchChannel[] = []
    for (let i = 0; i < count; i++) {
      const twitchChannel = await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: `id${i}`, globalInfoHistory: { create: createTwitchInfoHistory() }}})
      result.push(twitchChannel)
    }
    return result
  }
}

function createYoutubeInfoHistory () {
  return { imageUrl: '', isVerified: false, name: 'channel', time: new Date(), imageId: 1 }
}

function createTwitchInfoHistory () {
  return { colour: '', displayName: '', time: new Date(), userName: '', userType: '' }
}
