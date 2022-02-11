import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { ChannelName, CreateOrUpdateChannelArgs } from '@rebel/server/stores/ChannelStore'
import { expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof, single } from '@rebel/server/_test/utils'

const channelId1 = 'channelId1'
const channelId2 = 'channelId2'

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
  })

  afterEach(stopTestDb)

  describe(nameof(ChannelStore, 'exists'), () => {
    test('existing returns true', async () => {
      await db.channel.create({ data: { youtubeId: 'mockId' }})

      const result = await channelStore.exists('mockId')

      expect(result).toBe(true)
    })

    test('non-existing returns false', async () => {
      const result = await channelStore.exists('mockId')

      expect(result).toBe(false)
    })
  })

  describe(nameof(ChannelStore, 'createOrUpdate'), () => {
    // set up the database with sample data
    const nChannel = 2
    const nInfo = 3
    beforeEach(async () => {
      await db.channel.create({ data: {
        youtubeId: channelId1,
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} } 
      }})
      await db.channel.create({ data: {
        youtubeId: channelId2,
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
      const result = await channelStore.createOrUpdate(channelId2, channelInfo4)
      
      expect(result.youtubeId).toBe(channelId2)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo4))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo + 1])
    })

    test('stale channel info skips db update', async () => {
      const modifiedInfo2 = {
        ...channelInfo2,
        time: new Date(2021, 1, 3)
      }

      const result = await channelStore.createOrUpdate(channelId1, modifiedInfo2)

      expect(result.youtubeId).toBe(channelId1)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo2))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo])
    })
  })

  describe(nameof(ChannelStore, 'getCurrent'), () => {
    test(`returns null if channel doesn't exist`, async () => {
      await expect(channelStore.getCurrent('bad id')).resolves.toEqual(null)
    })

    test('returns channel with latest info', async () => {
      await db.channel.create({ data: {
        youtubeId: channelId1,
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} } 
      }})

      const result = (await channelStore.getCurrent(channelId1))!

      expect(result.youtubeId).toBe(channelId1)
      expect(single(result.infoHistory).time).toEqual(channelInfo2.time)
    })
  })

  describe(nameof(ChannelStore, 'getCurrentChannelNames'), () => {
    test('returns most up-to-date name of each channel', async () => {
      await db.channel.create({ data: {
        youtubeId: channelId1,
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} } 
      }})
      await db.channel.create({ data: {
        youtubeId: channelId2,
        infoHistory: { createMany: { data: [channelInfo3]} } 
      }})

      const result = await channelStore.getCurrentChannelNames()

      expect(result).toEqual<ChannelName[]>([{ youtubeId: channelId2, name: channelInfo3.name }, { youtubeId: channelId1, name: channelInfo2.name }])
    })
  })

  describe(nameof(ChannelStore, 'getHistory'), () => {
    test(`returns null if channel doesn't exist`, async () => {
      await expect(channelStore.getHistory('bad id')).resolves.toEqual(null)
    })

    test('returns ordered list of channel history', async () => {
      await db.channel.create({ data: {
        youtubeId: channelId1,
        infoHistory: { createMany: { data: [channelInfo1, channelInfo2]} } 
      }})
      
      const result = (await channelStore.getHistory(channelId1))!

      expect(result.length).toBe(2)

      // ordered from newest to oldest
      expect(result[0].time).toEqual(channelInfo2.time)
      expect(result[1].time).toEqual(channelInfo1.time)
    })
  })
}
