import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { UserNames, CreateOrUpdateChannelArgs, CreateOrUpdateTwitchChannelArgs } from '@rebel/server/stores/ChannelStore'
import { sortBy } from '@rebel/server/util/arrays'
import { randomString } from '@rebel/server/util/random'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof, single } from '@rebel/server/_test/utils'

const ytChannelId1 = 'channelId1'
const ytChannelId2 = 'channelId2'
const channelId1 = 1
const channelId2 = 2
const extTwitchChannelId1 = 'tchannelId1'
const extTwitchChannelId2 = 'tchannelId2'
const extTwitchChannelId3 = 'tchannelId3'
const twitchChannelId1 = 1
const twitchChannelId2 = 2

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

const baseTwitchChannelProps = {
  colour: '#FF00FF',
  isBroadcaster: false,
  isMod: false,
  isSubscriber: false,
  isVip: false,
  userType: ''
}
const twitchChannelInfo1: CreateOrUpdateTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 1),
  userName: 'User_1_A',
  displayName: 'User 1 A'
}
const twitchChannelInfo2: CreateOrUpdateTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 2),
  userName: 'User_1_B',
  displayName: 'User 1 B',
  isVip: true
}
const twitchChannelInfo3: CreateOrUpdateTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 3),
  userName: 'User_2_A',
  displayName: 'User 2 A',
  isSubscriber: true
}
const twitchChannelInfo4: CreateOrUpdateTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 4),
  userName: 'User_2_B',
  displayName: 'User 2 B',
  isBroadcaster: true
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
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} }
      }})
      await db.channel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo3]} } 
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { connect: { id: 1 }},
        infoHistory: { createMany: { data: [twitchChannelInfo2, twitchChannelInfo1]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { connect: { id: 2 }},
        infoHistory: { createMany: { data: [twitchChannelInfo3]} } 
      }})
    })
    
    // each of the following youtube tests is repeated for the twitch-equivalent test
    // the data values are approximately mirrored, so we expect both version of the test
    // to be extremely similar both in set up and expected outcome

    test('creating new youtube channel works', async () => {
      const result = await channelStore.createOrUpdate('youtube', 'channel3', channelInfo1)

      expect(result.youtubeId).toBe('channel3')
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo1))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel + 1, nInfo + 1])
    })

    test('creating new twitch channel works', async () => {
      const result = await channelStore.createOrUpdate('twitch', 'channel3', twitchChannelInfo1)

      expect(result.twitchId).toBe('channel3')
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(twitchChannelInfo1))
      await expectRowCount(db.twitchChannel, db.twitchChannelInfo).toEqual([nChannel + 1, nInfo + 1])
    })

    // ----

    test('updating existing youtube channel works', async () => {
      const result = await channelStore.createOrUpdate('youtube', ytChannelId2, channelInfo4)
      
      expect(result.youtubeId).toBe(ytChannelId2)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo4))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo + 1])
    })

    test('updating existing twitch channel works', async () => {
      const result = await channelStore.createOrUpdate('twitch', extTwitchChannelId2, twitchChannelInfo4)
      
      expect(result.twitchId).toBe(extTwitchChannelId2)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(twitchChannelInfo4))
      await expectRowCount(db.twitchChannel, db.twitchChannelInfo).toEqual([nChannel, nInfo + 1])
    })

    // ----

    test('stale youtube channel info skips db update', async () => {
      const modifiedInfo2 = {
        ...channelInfo2,
        time: new Date(2021, 1, 3)
      }

      const result = await channelStore.createOrUpdate('youtube', ytChannelId1, modifiedInfo2)

      expect(result.youtubeId).toBe(ytChannelId1)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo2))
      await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo])
    })

    test('stale twitch channel info skips db update', async () => {
      const modifiedInfo2 = {
        ...twitchChannelInfo2,
        time: new Date(2021, 1, 3)
      }

      const result = await channelStore.createOrUpdate('twitch', extTwitchChannelId1, modifiedInfo2)

      expect(result.twitchId).toBe(extTwitchChannelId1)
      expect(single(result.infoHistory)).toEqual(expect.objectContaining(twitchChannelInfo2))
      await expectRowCount(db.twitchChannel, db.twitchChannelInfo).toEqual([nChannel, nInfo])
    })
  })

  describe(nameof(ChannelStore, 'getCurrentUserNames'), () => {
    test('returns most up-to-date name of each channel, for multiple users', async () => {
      await db.channel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo2, channelInfo3, channelInfo1] } } 
      }})
      await db.channel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo4] } } 
      }})
      // user 2 has 3 twitch channels
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { connect: { id: 2 }},
        infoHistory: { createMany: { data: [twitchChannelInfo2, twitchChannelInfo3] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { connect: { id: 2 }},
        infoHistory: { createMany: { data: [twitchChannelInfo4] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId3,
        user: { connect: { id: 2 }},
        infoHistory: { createMany: { data: [twitchChannelInfo1] } }
      }})

      const result = await channelStore.getCurrentUserNames()

      const expected1: UserNames = { userId: 1, youtubeNames: [channelInfo3.name], twitchNames: [] }
      const expected2: UserNames = { userId: 2, youtubeNames: [channelInfo4.name], twitchNames: [twitchChannelInfo3.displayName, twitchChannelInfo4.displayName, twitchChannelInfo1.displayName] }
      expect(sortBy(result, 'userId')).toEqual<UserNames[]>([expected1, expected2])
    })
  })

  describe(nameof(ChannelStore, 'getUserId'), () => {
    test('throws if channel with given not found', async () => {
      await db.channel.create({ data: { user: { create: {}}, youtubeId: 'test_youtube' }})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: 'test_twitch' }})

      await expect(() => channelStore.getUserId('bad id')).rejects.toThrow()
    })

    test('returns correct id for youtube channel', async () => {
      await db.channel.create({ data: { user: { create: {}}, youtubeId: 'test_youtube' }})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: 'test_twitch' }})

      const result = await channelStore.getUserId('test_youtube')

      expect(result).not.toBeNull()
    })

    test('returns correct id for youtube channel', async () => {
      await db.channel.create({ data: { user: { create: {}}, youtubeId: 'test_youtube' }})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: 'test_twitch' }})

      const result = await channelStore.getUserId('test_twitch')

      expect(result).not.toBeNull()
    })
  })
}

/** Inserts ChannelInfos for separate channels, with the given channel names. It is assumed that all users exist. */
function insertNames (db: Db, names: UserNames[]) {
  for (const name of names) {
    for (const yt of name.youtubeNames) {
      db.channel.create({
        data: {
          youtubeId: randomString(4),
          user: { connect: { id: name.userId }},
          infoHistory: { create: { name: yt, time: new Date(), imageUrl: '', isModerator: false, isOwner: false, IsVerified: false }}
        }
      })
    }
    for (const tw of name.twitchNames) {
      db.twitchChannel.create({
        data: {
          twitchId: randomString(4),
          user: { connect: { id: name.userId }},
          infoHistory: { create: { displayName: tw, time: new Date(), colour: '', isBroadcaster: false, isMod: false, isSubscriber: false, isVip: false, userName: tw, userType: '' }}
        }
      })
    }
  }
}
