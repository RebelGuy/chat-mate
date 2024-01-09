import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { CreateOrUpdateGlobalYoutubeChannelArgs, CreateOrUpdateGlobalTwitchChannelArgs, UserChannel, CreateOrUpdateStreamerYoutubeChannelArgs, CreateOrUpdateStreamerTwitchChannelArgs } from '@rebel/server/stores/ChannelStore'
import { sortBy } from '@rebel/shared/util/arrays'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { addTime } from '@rebel/shared/util/datetime'
import * as data from '@rebel/server/_test/testData'
import { ChatMateError } from '@rebel/shared/util/error'

const ytChannelId1 = 'channelId1'
const ytChannelId2 = 'channelId2'
const ytChannelId3 = 'channelId3'
const extTwitchChannelId1 = 'tchannelId1'
const extTwitchChannelId2 = 'tchannelId2'
const extTwitchChannelId3 = 'tchannelId3'

const streamerId1 = 1
const streamerId2 = 2

const globalChannelInfo1: CreateOrUpdateGlobalYoutubeChannelArgs = {
  time: new Date(2021, 1, 1),
  name: 'User 1 A',
  imageUrl: 'www.image.com',
  isVerified: false
}
const globalChannelInfo2: CreateOrUpdateGlobalYoutubeChannelArgs = {
  time: new Date(2021, 1, 2),
  name: 'User 1 B',
  imageUrl: 'www.image.com',
  isVerified: false
}
const globalChannelInfo3: CreateOrUpdateGlobalYoutubeChannelArgs = {
  time: new Date(2021, 1, 3),
  name: 'User 2 A',
  imageUrl: 'www.image.net',
  isVerified: true
}
const globalChannelInfo4: CreateOrUpdateGlobalYoutubeChannelArgs = {
  time: new Date(2021, 1, 4),
  name: 'User 2 B',
  imageUrl: 'www.image.net',
  isVerified: false
}

const baseTwitchChannelProps = {
  colour: '#FF00FF',
  userType: ''
}
const baseTwitchChannelStreamerInfo = {
  isVip: false,
  isSubscriber: false,
  isBroadcaster: false,
  isMod: false
}
const twitchChannelGlobalInfo1: CreateOrUpdateGlobalTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 1),
  userName: 'User_1_A',
  displayName: 'User 1 A'
}
const twitchChannelGlobalInfo2: CreateOrUpdateGlobalTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 2),
  userName: 'User_1_B',
  displayName: 'User 1 B'
}
const twitchChannelGlobalInfo3: CreateOrUpdateGlobalTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 3),
  userName: 'User_2_A',
  displayName: 'User 2 A'
}
const twitchChannelGlobalInfo4: CreateOrUpdateGlobalTwitchChannelArgs = {
  ...baseTwitchChannelProps,
  time: new Date(2021, 1, 4),
  userName: 'User_2_B',
  displayName: 'User 2 B'
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

  describe(nameof(ChannelStore, 'createOrUpdateYoutubeChannel') + ' & ' + nameof(ChannelStore, 'createOrUpdateYoutubeChannel'), () => {
    // set up the database with sample data
    const nChannel = 2
    const nInfo = 3
    beforeEach(async () => {
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'test', aggregateChatUser: { create: {} } }} } })
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'test', aggregateChatUser: { create: {} } }} } })
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        globalInfoHistory: { createMany: { data: [globalChannelInfo2, globalChannelInfo1]} }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}},
        globalInfoHistory: { createMany: { data: [globalChannelInfo3]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { connect: { id: 1 }},
        globalInfoHistory: { createMany: { data: [twitchChannelGlobalInfo2, twitchChannelGlobalInfo1]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { connect: { id: 2 }},
        globalInfoHistory: { createMany: { data: [twitchChannelGlobalInfo3]} }
      }})
    })

    // each of the following youtube tests is repeated for the twitch-equivalent test
    // the data values are approximately mirrored, so we expect both version of the test
    // to be extremely similar both in set up and expected outcome

    test('creating new youtube channel works', async () => {
      const result = await channelStore.createOrUpdateYoutubeChannel('channel3', { ...globalChannelInfo1, streamerId: streamerId1, isModerator: false, isOwner: false })

      expect(result.youtubeId).toBe('channel3')
      expect(single(result.globalInfoHistory)).toEqual(expect.objectContaining(globalChannelInfo1))
      await expectRowCount(db.youtubeChannel, db.youtubeChannelGlobalInfo).toEqual([nChannel + 1, nInfo + 1])
    })

    test('creating new twitch channel works', async () => {
      const result = await channelStore.createOrUpdateTwitchChannel('channel3', { ...twitchChannelGlobalInfo1, ...baseTwitchChannelStreamerInfo, streamerId: streamerId1 })

      expect(result.twitchId).toBe('channel3')
      expect(single(result.globalInfoHistory)).toEqual(expect.objectContaining(twitchChannelGlobalInfo1))
      await expectRowCount(db.twitchChannel, db.twitchChannelGlobalInfo).toEqual([nChannel + 1, nInfo + 1])
    })

    // ----

    test('updating global data of existing youtube channel works', async () => {
      const result = await channelStore.createOrUpdateYoutubeChannel(ytChannelId2, { ...globalChannelInfo4, streamerId: streamerId1, isModerator: false, isOwner: false })

      expect(result.youtubeId).toBe(ytChannelId2)
      expect(single(result.globalInfoHistory)).toEqual(expect.objectContaining(globalChannelInfo4))
      await expectRowCount(db.youtubeChannel, db.youtubeChannelGlobalInfo).toEqual([nChannel, nInfo + 1])
    })

    test('updating global data of existing twitch channel works', async () => {
      const result = await channelStore.createOrUpdateTwitchChannel(extTwitchChannelId2, { ...twitchChannelGlobalInfo4, ...baseTwitchChannelStreamerInfo, streamerId: streamerId1 })

      expect(result.twitchId).toBe(extTwitchChannelId2)
      expect(single(result.globalInfoHistory)).toEqual(expect.objectContaining(twitchChannelGlobalInfo4))
      await expectRowCount(db.twitchChannel, db.twitchChannelGlobalInfo).toEqual([nChannel, nInfo + 1])
    })

    // ----

    test('updating streamer data of existing youtube channel works', async () => {
      await db.youtubeChannelStreamerInfo.create({ data: { channelId: 2, time: data.time2, streamerId: streamerId1, isModerator: false, isOwner: false } })

      await channelStore.createOrUpdateYoutubeChannel(ytChannelId2, { ...globalChannelInfo4, time: data.time3, streamerId: streamerId1, isModerator: true, isOwner: false })

      const storedInfo = await db.youtubeChannelStreamerInfo.findUnique({ where: { id: 2 }})
      expect(storedInfo!.isModerator).toBe(true)
    })

    test('updating streamer data of existing twitch channel works', async () => {
      await db.twitchChannelStreamerInfo.create({ data: { channelId: 2, time: data.time2, streamerId: streamerId1, isBroadcaster: false, isMod: false, isSubscriber: false, isVip: false } })

      await channelStore.createOrUpdateTwitchChannel(extTwitchChannelId2, { ...twitchChannelGlobalInfo4, time: data.time3, streamerId: streamerId1, isBroadcaster: false, isMod: true, isSubscriber: false, isVip: false })

      const storedInfo = await db.twitchChannelStreamerInfo.findUnique({ where: { id: 2 }})
      expect(storedInfo!.isMod).toBe(true)
    })

    // ----

    test('stale youtube channel info skips db update', async () => {
      const modifiedInfo2 = {
        ...globalChannelInfo2,
        time: new Date(2021, 1, 3),
        streamerId: streamerId1,
        isModerator: false,
        isOwner: false
      }

      const result = await channelStore.createOrUpdateYoutubeChannel(ytChannelId1, modifiedInfo2)

      expect(result.youtubeId).toBe(ytChannelId1)
      expect(single(result.globalInfoHistory)).toEqual(expect.objectContaining(globalChannelInfo2))
      await expectRowCount(db.youtubeChannel, db.youtubeChannelGlobalInfo).toEqual([nChannel, nInfo])
    })

    test('stale twitch channel info skips db update', async () => {
      const modifiedInfo2 = {
        ...twitchChannelGlobalInfo2,
        time: new Date(2021, 1, 3)
      }

      const result = await channelStore.createOrUpdateTwitchChannel(extTwitchChannelId1, { ...modifiedInfo2, ...baseTwitchChannelStreamerInfo, streamerId: streamerId1 })

      expect(result.twitchId).toBe(extTwitchChannelId1)
      expect(single(result.globalInfoHistory)).toEqual(expect.objectContaining(twitchChannelGlobalInfo2))
      await expectRowCount(db.twitchChannel, db.twitchChannelGlobalInfo).toEqual([nChannel, nInfo])
    })
  })

  describe(nameof(ChannelStore, 'getChannelCount'), () => {
    test('Returns the number of channels, including both Youtube and Twitch channels', async () => {
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

      const result = await channelStore.getChannelCount()

      expect(result).toBe(3)
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
        globalInfoHistory: { createMany: { data: [globalChannelInfo2, globalChannelInfo1] } }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}}, // default user 5
        globalInfoHistory: { createMany: { data: [globalChannelInfo3] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}}, // default user 6
        globalInfoHistory: { createMany: { data: [twitchChannelGlobalInfo2, twitchChannelGlobalInfo3] } }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: { aggregateChatUserId: 3 }}, // default user 7
        globalInfoHistory: { createMany: { data: [twitchChannelGlobalInfo4] } }
      }})
      await db.twitchChannel.create({ data: { // no chat messages
        twitchId: extTwitchChannelId3,
        user: { create: { aggregateChatUserId: 3 }}, // default user 8
        globalInfoHistory: { createMany: { data: [twitchChannelGlobalInfo1] } }
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

  describe(nameof(ChannelStore, 'getTwitchChannelsFromChannelIds'), () => {
    test('Gets Twitch channel with latest info', async () => {
      const time1 = new Date()
      const time2 = addTime(time1, 'seconds', 10)

      await db.chatUser.create({ data: {}}) // aggregate user 1
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}}, // default user 2
        globalInfoHistory: { createMany: { data: [twitchChannelGlobalInfo1]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: { aggregateChatUserId: 1 }}, // default user 3
        globalInfoHistory: { createMany: { data: [{ ...twitchChannelGlobalInfo2, time: time1 }, { ...twitchChannelGlobalInfo3, time: time2 }]} }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId3,
        user: { create: {}}, // default user 4
        globalInfoHistory: { createMany: { data: [twitchChannelGlobalInfo4]} }
      }})

      const result = await channelStore.getTwitchChannelsFromChannelIds([2, 3])

      expect(result.length).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, [
        { defaultUserId: 3, aggregateUserId: 1, platformInfo: { channel: { twitchId: extTwitchChannelId2, globalInfoHistory: [{ userName: twitchChannelGlobalInfo3.userName }] }}},
        { defaultUserId: 4, aggregateUserId: null, platformInfo: { channel: { twitchId: extTwitchChannelId3, globalInfoHistory: [{ userName: twitchChannelGlobalInfo4.userName }] }}}
      ]))
    })
  })

  describe(nameof(ChannelStore, 'getYoutubeChannelsFromChannelIds'), () => {
    test('Gets YouTube channel with latest info', async () => {
      const time1 = new Date()
      const time2 = addTime(time1, 'seconds', 10)
      const time3 = addTime(time2, 'seconds', 10)

      await db.chatUser.create({ data: {}}) // aggregate user 1
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}}, // default user 2
        globalInfoHistory: { createMany: { data: [globalChannelInfo1]} }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: { aggregateChatUserId: 1 }}, // default user 3
        globalInfoHistory: { createMany: { data: [{ ...globalChannelInfo2, time: time3 }, { ...globalChannelInfo3, time: time2 }]} }
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId3,
        user: { create: {}}, // default user 4
        globalInfoHistory: { createMany: { data: [globalChannelInfo4]} }
      }})

      const result = await channelStore.getYoutubeChannelsFromChannelIds([2, 3])

      expect(result.length).toBe(2)
      expect(result).toEqual(expectObjectDeep(result, [
        { defaultUserId: 3, aggregateUserId: 1, platformInfo: { channel: { youtubeId: ytChannelId2, globalInfoHistory: [{ name: globalChannelInfo2.name }] }}},
        { defaultUserId: 4, aggregateUserId: null, platformInfo: { channel: { youtubeId: ytChannelId3, globalInfoHistory: [{ name: globalChannelInfo4.name }] }}}
      ]))
    })
  })

  describe(nameof(ChannelStore, 'getYoutubeChannelHistoryForStreamer'), () => {
    test('Returns the latest 2 items from the specified channel', async () => {
      const streamerChannelInfo1: CreateOrUpdateStreamerYoutubeChannelArgs = { time: data.time1, isModerator: false, isOwner: true, streamerId: streamerId1 }
      const streamerChannelInfo2: CreateOrUpdateStreamerYoutubeChannelArgs = { time: data.time2, isModerator: true, isOwner: true, streamerId: streamerId2 }
      const streamerChannelInfo3: CreateOrUpdateStreamerYoutubeChannelArgs = { time: data.time3, isModerator: true, isOwner: true, streamerId: streamerId1 }
      const streamerChannelInfo4: CreateOrUpdateStreamerYoutubeChannelArgs = { time: data.time4, isModerator: true, isOwner: true, streamerId: streamerId1 }

      await db.streamer.create({ data: {
        registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}
      })
      await db.streamer.create({ data: {
        registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}
      })
      const channel1 = await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId1,
        user: { create: {}},
        streamerInfoHistory: { createMany: { data: [streamerChannelInfo2, streamerChannelInfo1, streamerChannelInfo3] }}
      }})
      await db.youtubeChannel.create({ data: {
        youtubeId: ytChannelId2,
        user: { create: {}},
        streamerInfoHistory: { createMany: { data: [streamerChannelInfo4] }}
      }})

      const result = await channelStore.getYoutubeChannelHistoryForStreamer(streamerId1, channel1.id, 2)

      expect(result).toEqual(expectObject(result, [
        { id: 3 }, { id: 2 }
      ]))
    })
  })

  describe(nameof(ChannelStore, 'getTwitchChannelHistoryForStreamer'), () => {
    test('Returns the latest 2 items from the specified channel', async () => {
      const streamerChannelInfo1: CreateOrUpdateStreamerTwitchChannelArgs = { time: data.time1, streamerId: streamerId1, isBroadcaster: false, isMod: false, isSubscriber: false, isVip: false }
      const streamerChannelInfo2: CreateOrUpdateStreamerTwitchChannelArgs = { time: data.time2, streamerId: streamerId2, isBroadcaster: false, isMod: false, isSubscriber: false, isVip: false }
      const streamerChannelInfo3: CreateOrUpdateStreamerTwitchChannelArgs = { time: data.time3, streamerId: streamerId1, isBroadcaster: false, isMod: false, isSubscriber: false, isVip: false }
      const streamerChannelInfo4: CreateOrUpdateStreamerTwitchChannelArgs = { time: data.time4, streamerId: streamerId1, isBroadcaster: false, isMod: false, isSubscriber: false, isVip: false }

      await db.streamer.create({ data: {
        registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}
      })
      await db.streamer.create({ data: {
        registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}
      })
      const channel1 = await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId1,
        user: { create: {}},
        streamerInfoHistory: { createMany: { data: [streamerChannelInfo2, streamerChannelInfo1, streamerChannelInfo3] }}
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: {}},
        streamerInfoHistory: { createMany: { data: [streamerChannelInfo4] }}
      }})

      const result = await channelStore.getTwitchChannelHistoryForStreamer(streamerId1, channel1.id, 2)

      expect(result).toEqual(expectObject(result, [
        { id: 3 }, { id: 2 }
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
        globalInfoHistory: { create: twitchChannelGlobalInfo1 }
      }})
      await db.twitchChannel.create({ data: {
        twitchId: extTwitchChannelId2,
        user: { create: {}},
        globalInfoHistory: { create: twitchChannelGlobalInfo2 }
      }})
    })

    test('Returns the YouTube channel associated with the external id', async () => {
      const result = await channelStore.getChannelFromUserNameOrExternalId(ytChannelId2)

      expect(result!.userId).toBe(2)
    })

    test('Returns the Twitch channel associated with the external id', async () => {
      const result = await channelStore.getChannelFromUserNameOrExternalId(twitchChannelGlobalInfo1.userName.toUpperCase())

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

      await expect(() => channelStore.getPrimaryUserId('bad id')).rejects.toThrowError(ChatMateError)
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
      await expect(() => channelStore.getConnectedUserOwnedChannels([1])).rejects.toThrowError(ChatMateError)
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
      await expect(() => channelStore.getDefaultUserOwnedChannels([1])).rejects.toThrowError(ChatMateError)
    })
  })
}
