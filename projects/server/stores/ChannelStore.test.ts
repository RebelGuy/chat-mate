import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { ChannelName, CreateOrUpdateChannelArgs } from '@rebel/server/stores/ChannelStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof, single } from '@rebel/server/_test/utils'

const ytChannelId1 = 'channelId1'
const ytChannelId2 = 'channelId2'
const channelId1 = 1
const channelId2 = 2

const channelInfo1: CreateOrUpdateChannelArgs = {
  time: new Date(2021, 1, 1),
  name: 'User 1 A',
  imageUrl: 'www.image.com',
  isOwner: false,
  isModerator: true,
  IsVerified: false
}
const channelInfo2: CreateOrUpdateChannelArgs = {
  time: new Date(2021, 1, 2),
  name: 'User 1 B',
  imageUrl: 'www.image.com',
  isOwner: false,
  isModerator: false,
  IsVerified: false
}
const channelInfo3: CreateOrUpdateChannelArgs = {
  time: new Date(2021, 1, 3),
  name: 'User 2 A',
  imageUrl: 'www.image.net',
  isOwner: false,
  isModerator: false,
  IsVerified: true
}
const channelInfo4: CreateOrUpdateChannelArgs = {
  time: new Date(2021, 1, 4),
  name: 'User 2 B',
  imageUrl: 'www.image.net',
  isOwner: true,
  isModerator: false,
  IsVerified: false
}

export default () => {
  let channelStore: ChannelStore
  let db: Db
  beforeEach(async () => {
    const dbProvider = await startTestDb()
    channelStore = new ChannelStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(ChannelStore, 'createOrUpdate'), () => {
    // set up the database with sample data
    const nChannel = 2
    const nInfo = 3
    beforeEach(async () => {
      await db.channel.create({ data: {
        youtubeId: ytChannelId1,
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} } 
      }})
      await db.channel.create({ data: {
        youtubeId: ytChannelId2,
        infoHistory: { createMany: { data: [channelInfo3]} } 
      }})
    })

    test('creating new channel works', async () => {
      const result = await channelStore.createOrUpdate('channel3', channelInfo1)

      expect(result.youtubeId).toBe('channel3')
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo1))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel + 1, nInfo + 1])
    })

    test('updating existing channel works', async () => {
      const result = await channelStore.createOrUpdate(ytChannelId2, channelInfo4)
      
      expect(result.youtubeId).toBe(ytChannelId2)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo4))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo + 1])
    })

    test('stale channel info skips db update', async () => {
      const modifiedInfo2 = {
        ...channelInfo2,
        time: new Date(2021, 1, 3)
      }

      const result = await channelStore.createOrUpdate(ytChannelId1, modifiedInfo2)

      expect(result.youtubeId).toBe(ytChannelId1)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo2))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo])
    })
  })

  describe(nameof(ChannelStore, 'getCurrent'), () => {
    test(`returns null if channel doesn't exist`, async () => {
      await expect(channelStore.getCurrent(100)).resolves.toEqual(null)
    })

    test('returns channel by id with latest info', async () => {
      const stored = await db.channel.create({ data: {
        youtubeId: ytChannelId1,
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} } 
      }})

      const result = (await channelStore.getCurrent(stored.id))!

      expect(result.id).toBe(stored.id)
      expect(single(result.infoHistory).time).toEqual(channelInfo2.time)
    })

    test('returns channel by youtubeId with latest info', async () => {
      await db.channel.create({ data: {
        youtubeId: ytChannelId1,
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} } 
      }})

      const result = (await channelStore.getCurrent(channelId1))!

      expect(result.youtubeId).toBe(ytChannelId1)
      expect(single(result.infoHistory).time).toEqual(channelInfo2.time)
    })
  })

  describe(nameof(ChannelStore, 'getCurrentChannelNames'), () => {
    test('returns most up-to-date name of each channel', async () => {
      await db.channel.create({ data: {
        youtubeId: ytChannelId1,
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} } 
      }})
      await db.channel.create({ data: {
        youtubeId: ytChannelId2,
        infoHistory: { createMany: { data: [channelInfo3]} } 
      }})

      const result = await channelStore.getCurrentChannelNames()

      const expected1: ChannelName = { id: channelId2, name: channelInfo3.name }
      const expected2: ChannelName = { id: channelId1, name: channelInfo2.name }
      expect(result).toEqual<ChannelName[]>([expected1, expected2])
    })
  })

  describe(nameof(ChannelStore, 'getHistory'), () => {
    test(`returns null if channel doesn't exist`, async () => {
      await expect(channelStore.getHistory(100)).resolves.toEqual(null)
    })

    test('returns ordered list of channel history', async () => {
      await db.channel.create({ data: {
        youtubeId: ytChannelId1,
        infoHistory: { createMany: { data: [channelInfo1, channelInfo2]} } 
      }})
      
      const result = (await channelStore.getHistory(channelId1))!

      expect(result.length).toBe(2)

      // ordered from newest to oldest
      expect(result[0].time).toEqual(channelInfo2.time)
      expect(result[1].time).toEqual(channelInfo1.time)
    })
  })

  describe(nameof(ChannelStore, 'getId'), () => {
    test('throws if channel with given youtubeId not found', async () => {
      await expect(() => channelStore.getId('bad id')).rejects.toThrow()
    })

    test('returns correct id', async () => {
      await db.channel.create({ data: { youtubeId: 'test' }})

      const result = await channelStore.getId('test')

      expect(result).not.toBeNull()
    })
  })
}
