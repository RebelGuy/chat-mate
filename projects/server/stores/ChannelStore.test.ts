import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { UserNames, CreateOrUpdateYoutubeChannelArgs, CreateOrUpdateTwitchChannelArgs } from '@rebel/server/stores/ChannelStore'
import { sortBy } from '@rebel/server/util/arrays'
import { randomString } from '@rebel/server/util/random'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'

const ytChannelId1 = 'channelId1'
const ytChannelId2 = 'channelId2'
const channelId1 = 1
const channelId2 = 2
const extTwitchChannelId1 = 'tchannelId1'
const extTwitchChannelId2 = 'tchannelId2'
const extTwitchChannelId3 = 'tchannelId3'
const twitchChannelId1 = 1
const twitchChannelId2 = 2

const channelInfo1: CreateOrUpdateYoutubeChannelArgs = {
  time: new Date(2021, 1, 1),
  name: 'User 1 A',
  imageUrl: 'www.image.com',
  isOwner: false,
  isModerator: true,
  isVerified: false
}
const channelInfo2: CreateOrUpdateYoutubeChannelArgs = {
  time: new Date(2021, 1, 2),
  name: 'User 1 B',
  imageUrl: 'www.image.com',
  isOwner: false,
  isModerator: false,
  isVerified: false
}
const channelInfo3: CreateOrUpdateYoutubeChannelArgs = {
  time: new Date(2021, 1, 3),
  name: 'User 2 A',
  imageUrl: 'www.image.net',
  isOwner: false,
  isModerator: false,
  isVerified: true
}
const channelInfo4: CreateOrUpdateYoutubeChannelArgs = {
  time: new Date(2021, 1, 4),
  name: 'User 2 B',
  imageUrl: 'www.image.net',
  isOwner: true,
  isModerator: false,
  isVerified: false
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
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1]} }
      }})
      await db.youtubeChannel.create({ data: {
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
      await expectRowCount(db.youtubeChannel, db.youtubeChannelInfo).toEqual([nChannel + 1, nInfo + 1])
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
      await expectRowCount(db.youtubeChannel, db.youtubeChannelInfo).toEqual([nChannel, nInfo + 1])
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
      await expectRowCount(db.youtubeChannel, db.youtubeChannelInfo).toEqual([nChannel, nInfo])
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

  describe(nameof(ChannelStore, 'getCurrentUserIds'), () => {
    test('returns single user if all channels belong to the same user', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo2, channelInfo3, channelInfo1] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { connect: { id: 1 }},
        infoHistory: { createMany: { data: [twitchChannelInfo2, twitchChannelInfo3] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { connect: { id: 1 }},
        infoHistory: { createMany: { data: [twitchChannelInfo4] } }
      }})

      const result = await channelStore.getCurrentUserIds()

      expect(single(result)).toBe(1)
    })

    test('returns all distinct user ids', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo2, channelInfo3, channelInfo1] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [twitchChannelInfo2, twitchChannelInfo3] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: {}},
        infoHistory: { createMany: { data: [twitchChannelInfo4] } }
      }})

      const result = await channelStore.getCurrentUserIds()

      expect(result.sort()).toEqual([1, 2, 3])
    })

    test('ignores default users that are connected to an aggregate user', async () => {
      await db.chatUser.create({ data: {}})
      await db.chatUser.create({ data: {}}) // aggregate user
      await db.chatUser.create({ data: { aggregateChatUserId: 2 }})
      await db.chatUser.create({ data: { aggregateChatUserId: 2 }})

      const result = await channelStore.getCurrentUserIds()

      expect(result.sort()).toEqual([1, 2])
    })
  })

  describe(nameof(ChannelStore, 'getCurrentUserNames'), () => {
    test('returns most up-to-date name of each channel, for multiple users', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo2, channelInfo3, channelInfo1] } }
      }})
      await db.youtubeChannel.create({ data: {
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
      const expected2: UserNames = { userId: 2, youtubeNames: [channelInfo4.name], twitchNames: [twitchChannelInfo4.displayName, twitchChannelInfo3.displayName, twitchChannelInfo1.displayName] }
      expect(sortBy(result, 'userId')).toEqual<UserNames[]>([expected1, expected2])
    })
  })

  describe(nameof(ChannelStore, 'getTwitchUserNameFromChannelId'), () => {
    test('gets correct name', async () => {
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [twitchChannelInfo1]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: {}},
        infoHistory: { createMany: { data: [twitchChannelInfo2]} }
      }})

      const result = await channelStore.getTwitchUserNameFromChannelId(2)

      expect(result).toEqual(twitchChannelInfo2.userName)
    })
  })

  describe(nameof(ChannelStore, 'getYoutubeChannelNameFromChannelId'), () => {
    test('gets correct name', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo1]} }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}},
        infoHistory: { createMany: { data: [channelInfo3]} }
      }})

      const result = await channelStore.getYoutubeChannelNameFromChannelId(2)

      expect(result).toEqual(channelInfo3.name)
    })
  })

  describe(nameof(ChannelStore, 'getPrimaryUserId'), () => {
    test('throws if channel with given not found', async () => {
      await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: 'test_youtube' }})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: 'test_twitch' }})

      await expect(() => channelStore.getPrimaryUserId('bad id')).rejects.toThrow()
    })

    test('returns correct default id for youtube channel', async () => {
      await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: 'test_youtube' }})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: 'test_twitch' }})

      const result = await channelStore.getPrimaryUserId('test_youtube')

      expect(result).toBe(1)
    })

    test('returns correct aggregate id for youtube channel', async () => {
      await db.registeredUser.create({ data: { username: 'test', hashedPassword: 'test', aggregateChatUser: { create: {}}}})
      await db.youtubeChannel.create({ data: { user: { create: { aggregateChatUserId: 1 }}, youtubeId: 'test_youtube' }})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: 'test_twitch' }})

      const result = await channelStore.getPrimaryUserId('test_youtube')

      expect(result).toBe(1)
    })

    test('returns correct default id for twtich channel', async () => {
      await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: 'test_youtube' }})
      await db.twitchChannel.create({ data: { user: { create: {}}, twitchId: 'test_twitch' }})

      const result = await channelStore.getPrimaryUserId('test_twitch')

      expect(result).toBe(2)
    })

    test('returns correct aggregate id for twitch channel', async () => {
      await db.youtubeChannel.create({ data: { user: { create: {}}, youtubeId: 'test_youtube' }})
      await db.registeredUser.create({ data: { username: 'test', hashedPassword: 'test', aggregateChatUser: { create: {}}}})
      await db.twitchChannel.create({ data: { user: { create: { aggregateChatUserId: 2 }}, twitchId: 'test_twitch' }})

      const result = await channelStore.getPrimaryUserId('test_twitch')

      expect(result).toBe(2)
    })
  })

  describe(nameof(ChannelStore, 'getUserOwnedChannels'), () => {
    test('throws if user does not exist', async () => {
      await expect(() => channelStore.getUserOwnedChannels(1)).rejects.toThrow()
    })

    test('returns all youtube and twitch channel ids for this default user', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}}
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}}
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}}
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: {}}
      }})

      const result = await channelStore.getUserOwnedChannels(2)

      expect(result.userId).toBe(2)
      expect(result.youtubeChannels).toEqual([2])
      expect(result.twitchChannels).toEqual([])
    })

    test('returns all youtube and twitch channel ids for this aggregate user', async () => {
      await db.registeredUser.create({ data: { username: 'test', hashedPassword: 'test', aggregateChatUser: { create: {}}}})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: { aggregateChatUserId: 1 }}
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: { aggregateChatUserId: 1 }}
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}}
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: { aggregateChatUserId: 1 }}
      }})

      const result = await channelStore.getUserOwnedChannels(1)

      expect(result.userId).toBe(1)
      expect(result.youtubeChannels).toEqual([1, 2])
      expect(result.twitchChannels).toEqual([2])
    })
  })
}

/** Inserts ChannelInfos for separate channels, with the given channel names. It is assumed that all users exist. */
function insertNames (db: Db, names: UserNames[]) {
  for (const name of names) {
    for (const yt of name.youtubeNames) {
      db.youtubeChannel.create({
        data: {
          youtubeId: randomString(4),
          user: { connect: { id: name.userId }},
          infoHistory: { create: { name: yt, time: new Date(), imageUrl: '', isModerator: false, isOwner: false, isVerified: false }}
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
