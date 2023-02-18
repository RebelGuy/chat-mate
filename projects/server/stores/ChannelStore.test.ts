import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { CreateOrUpdateYoutubeChannelArgs, CreateOrUpdateTwitchChannelArgs, UserChannel } from '@rebel/server/stores/ChannelStore'
import { sortBy } from '@rebel/shared/util/arrays'
import { randomString } from '@rebel/shared/util/random'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectArray, expectObject, expectObjectDeep, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/shared/util/arrays'
import { addTime } from '@rebel/shared/util/datetime'
import * as data from '@rebel/server/_test/testData'

const ytChannelId1 = 'channelId1'
const ytChannelId2 = 'channelId2'
const ytChannelId3 = 'channelId3'
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

  describe(nameof(ChannelStore, 'getAllChannels'), () => {
    test('Returns every channel that has authored a chat message for the given streamer', async () => {
      await db.chatUser.create({ data: { }}) // aggregate user 1 (streamer1)
      await db.chatUser.create({ data: { }}) // aggregate user 2 (streamer2)
      await db.chatUser.create({ data: { }}) // aggregate user 3
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'test', aggregateChatUserId: 1 }} } })
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'test', aggregateChatUserId: 2 }} } })
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: { aggregateChatUserId: 3 }}, // default user 4
        infoHistory: { createMany: { data: [channelInfo2, channelInfo1] } }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}}, // default user 5
        infoHistory: { createMany: { data: [channelInfo3] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}}, // default user 6
        infoHistory: { createMany: { data: [twitchChannelInfo2, twitchChannelInfo3] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: { aggregateChatUserId: 3 }}, // default user 7
        infoHistory: { createMany: { data: [twitchChannelInfo4] } }
      }})
      await db.twitchChannel.create({ data: { // no chat messages
        twitchId: extTwitchChannelId3,
        user: { create: { aggregateChatUserId: 3 }}, // default user 8
        infoHistory: { createMany: { data: [twitchChannelInfo1] } }
      }})
      await db.chatMessage.createMany({ data: [
        { streamerId: 1, externalId: 'msg1', time: data.time1, youtubeChannelId: 1 }, // match
        { streamerId: 2, externalId: 'msg2', time: data.time2, youtubeChannelId: 2 },
        { streamerId: 1, externalId: 'msg3', time: data.time3, twitchChannelId: 1 }, // match
        { streamerId: 1, externalId: 'msg4', time: data.time4, twitchChannelId: 2 }, // match
        { streamerId: 2, externalId: 'msg5', time: data.time4, twitchChannelId: 2 },
        { streamerId: 1, externalId: 'msg6', time: data.time4, youtubeChannelId: 1 }, // second message of this channel
      ]})

      const result = sortBy(await channelStore.getAllChannels(1), c => c.defaultUserId)

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expectObjectDeep<UserChannel>({ aggregateUserId: 3, defaultUserId: 4, platformInfo: { channel: { youtubeId: ytChannelId1 }}}))
      expect(result[1]).toEqual(expectObjectDeep<UserChannel>({ aggregateUserId: null, defaultUserId: 6, platformInfo: { channel: { twitchId: extTwitchChannelId1 }}}))
      expect(result[2]).toEqual(expectObjectDeep<UserChannel>({ aggregateUserId: 3, defaultUserId: 7, platformInfo: { channel: { twitchId: extTwitchChannelId2 }}}))
    })
  })

  describe(nameof(ChannelStore, 'getTwitchChannelFromChannelId'), () => {
    test('Gets Twitch channel with latest info', async () => {
      const time1 = new Date()
      const time2 = addTime(time1, 'seconds', 10)

      await db.chatUser.create({ data: {}}) // aggregate user 1
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}}, // default user 2
        infoHistory: { createMany: { data: [twitchChannelInfo1]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: { aggregateChatUserId: 1 }}, // default user 3
        infoHistory: { createMany: { data: [{ ...twitchChannelInfo2, time: time1 }, { ...twitchChannelInfo3, time: time2 }]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId3,
        user: { create: {}}, // default user 4
        infoHistory: { createMany: { data: [twitchChannelInfo4]} }
      }})

      const result = await channelStore.getTwitchChannelFromChannelId([2, 3])

      expect(result.length).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, [
        { defaultUserId: 3, aggregateUserId: 1, platformInfo: { channel: { twitchId: extTwitchChannelId2, infoHistory: [{ userName: twitchChannelInfo3.userName }] }}},
        { defaultUserId: 4, aggregateUserId: null, platformInfo: { channel: { twitchId: extTwitchChannelId3, infoHistory: [{ userName: twitchChannelInfo4.userName }] }}}
      ]))
    })
  })

  describe(nameof(ChannelStore, 'getYoutubeChannelFromChannelId'), () => {
    test('Gets YouTube channel with latest info', async () => {
      const time1 = new Date()
      const time2 = addTime(time1, 'seconds', 10)
      const time3 = addTime(time2, 'seconds', 10)

      await db.chatUser.create({ data: {}}) // aggregate user 1
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}}, // default user 2
        infoHistory: { createMany: { data: [channelInfo1]} }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: { aggregateChatUserId: 1 }}, // default user 3
        infoHistory: { createMany: { data: [{ ...channelInfo2, time: time3 }, { ...channelInfo3, time: time2 }]} }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId3,
        user: { create: {}}, // default user 4
        infoHistory: { createMany: { data: [channelInfo4]} }
      }})

      const result = await channelStore.getYoutubeChannelFromChannelId([2, 3])

      expect(result.length).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, [
        { defaultUserId: 3, aggregateUserId: 1, platformInfo: { channel: { youtubeId: ytChannelId2, infoHistory: [{ name: channelInfo2.name }] }}},
        { defaultUserId: 4, aggregateUserId: null, platformInfo: { channel: { youtubeId: ytChannelId3, infoHistory: [{ name: channelInfo4.name }] }}}
      ]))
    })
  })

  describe(nameof(ChannelStore, 'getChannelFromUserNameOrExternalId'), () => {
    beforeEach(async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}},
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}},
        infoHistory: { create: twitchChannelInfo1 }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: {}},
        infoHistory: { create: twitchChannelInfo2 }
      }})
    })

    test('Returns the YouTube channel associated with the external id', async () => {
      const result = await channelStore.getChannelFromUserNameOrExternalId(ytChannelId2)

      expect(result!.userId).toBe(2)
    })

    test('Returns the Twitch channel associated with the external id', async () => {
      const result = await channelStore.getChannelFromUserNameOrExternalId(twitchChannelInfo1.userName.toUpperCase())

      expect(result!.userId).toBe(3)
    })

    test('Returns null if no YouTube or Twitch channel can be found', async () => {
      const result = await channelStore.getChannelFromUserNameOrExternalId('test')

      expect(result).toBeNull()
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

  describe(nameof(ChannelStore, 'getConnectedUserOwnedChannels'), () => {
    test('throws if user does not exist', async () => {
      await expect(() => channelStore.getConnectedUserOwnedChannels([1])).rejects.toThrow()
    })

    test('Returns linked channels for default or aggregate users, and single channel for an unlinked default user', async () => {
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

      const result = await channelStore.getConnectedUserOwnedChannels([1, 2, 4])

      expect(sortBy(result, r => r.userId)).toEqual(expectObjectDeep(result, [
        { userId: 1, aggregateUserId: 1, youtubeChannelIds: [1, 2], twitchChannelIds: [2] },
        { userId: 2, aggregateUserId: 1, youtubeChannelIds: [1, 2], twitchChannelIds: [2] },
        { userId: 4, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [1] },
      ]))
    })
  })

  describe(nameof(ChannelStore, 'getDefaultUserOwnedChannels'), () => {
    test('Returns all youtube and twitch channel ids for this default user', async () => {
      await db.registeredUser.create({ data: { username: 'test', hashedPassword: 'test', aggregateChatUser: { create: {}}}})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: { aggregateChatUserId: 1 }}
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: { aggregateChatUserId: 1 }} // user 3
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: { }} // user 4
      }})

      const result = await channelStore.getDefaultUserOwnedChannels([3, 4])

      expect(result.length).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, [
        { userId: 3, aggregateUserId: 1, youtubeChannelIds: [2], twitchChannelIds: [] },
        { userId: 4, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [1] }
      ]))
    })

    test('Throws if user does not exist', async () => {
      await expect(() => channelStore.getDefaultUserOwnedChannels([1])).rejects.toThrow()
    })
  })
}
