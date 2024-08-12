import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { CreateOrUpdateGlobalYoutubeChannelArgs, CreateOrUpdateGlobalTwitchChannelArgs, UserChannel, CreateOrUpdateStreamerYoutubeChannelArgs, CreateOrUpdateStreamerTwitchChannelArgs, CreateOrUpdateYoutubeChannelArgs, CreateOrUpdateTwitchChannelArgs } from '@rebel/server/stores/ChannelStore'
import { sortBy } from '@rebel/shared/util/arrays'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { addTime } from '@rebel/shared/util/datetime'
import * as data from '@rebel/server/_test/testData'
import { ChatMateError } from '@rebel/shared/util/error'
import { ImageInfo } from '@rebel/server/services/ImageService'
import { SafeOmit } from '@rebel/shared/types'

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
  isVerified: false,
  imageId: 1
}
const globalChannelInfo2: CreateOrUpdateGlobalYoutubeChannelArgs = {
  time: new Date(2021, 1, 2),
  name: 'User 1 B',
  imageUrl: 'www.image.com',
  isVerified: false,
  imageId: 1
}
const globalChannelInfo3: CreateOrUpdateGlobalYoutubeChannelArgs = {
  time: new Date(2021, 1, 3),
  name: 'User 2 A',
  imageUrl: 'www.image.net',
  isVerified: true,
  imageId: 1
}
const globalChannelInfo4: CreateOrUpdateGlobalYoutubeChannelArgs = {
  time: new Date(2021, 1, 4),
  name: 'User 2 B',
  imageUrl: 'www.image.net',
  isVerified: false,
  imageId: 1
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

  describe(nameof(ChannelStore, 'createYoutubeChannel'), () => {
    test('Creates the channel with the correct image data', async () => {
      await db.chatUser.create({ data: {}})
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user', hashedPassword: 'password', aggregateChatUserId: 1 }}}})
      const externalId = 'externalId'
      const channelInfo: CreateOrUpdateYoutubeChannelArgs = {
        imageUrl: 'imageUrl',
        isModerator: false,
        isOwner: true,
        isVerified: false,
        name: 'name',
        streamerId: 1,
        time: data.time1
      }
      const onGetImageInfo = (channelId: number, channelGlobalInfoId: number) => Promise.resolve<ImageInfo>({
        relativeImageUrl: `${channelId}/${channelGlobalInfoId}.png`,
        imageHeight: 20,
        imageWidth: 40
      })

      const result = await channelStore.createYoutubeChannel(externalId, channelInfo, onGetImageInfo)

      // check result is correct
      expect(result).toEqual(expectObjectDeep(result, { youtubeId: externalId, globalInfoHistory: [{ imageUrl: channelInfo.imageUrl, imageId: 1, name: 'name' }]}))

      // make sure we have persisted the expected data
      const storedImage = await db.image.findMany({}).then(single)
      expect(storedImage).toEqual(expectObject(storedImage, { originalUrl: channelInfo.imageUrl, width: 40, height: 20 }))
      await expectRowCount(db.youtubeChannel, db.youtubeChannelGlobalInfo, db.youtubeChannelStreamerInfo).toEqual([1, 1, 1])
    })
  })

  describe(nameof(ChannelStore, 'createTwitchChannel'), () => {
    test('Creates the channel', async () => {
      await db.chatUser.create({ data: {}})
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user', hashedPassword: 'password', aggregateChatUserId: 1 }}}})
      const externalId = 'externalId'
      const channelInfo: CreateOrUpdateTwitchChannelArgs = {
        isMod: false,
        isBroadcaster: true,
        isSubscriber: false,
        isVip: false,
        colour: '',
        displayName: 'name',
        streamerId: 1,
        time: data.time1,
        userName: 'name',
        userType: ''
      }

      const result = await channelStore.createTwitchChannel(externalId, channelInfo)

      // check result is correct
      expect(result).toEqual(expectObjectDeep(result, { twitchId: externalId, globalInfoHistory: [{ displayName: 'name' }]}))

      // make sure we have persisted the expected data
      await expectRowCount(db.twitchChannel, db.twitchChannelGlobalInfo, db.twitchChannelStreamerInfo).toEqual([1, 1, 1])
    })
  })

  describe(nameof(ChannelStore, 'getYoutubeChannelCount'), () => {
    test('Returns the number of Youtube channels', async () => {
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

      const result = await channelStore.getYoutubeChannelCount()

      expect(result).toBe(2)
    })
  })

  describe(nameof(ChannelStore, 'getTwitchChannelCount'), () => {
    test('Returns the number of Twitch channels', async () => {
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

      const result = await channelStore.getTwitchChannelCount()

      expect(result).toBe(1)
    })
  })

  describe(nameof(ChannelStore, 'getAllChannels'), () => {
    test('Returns every channel that has authored a chat message for the given streamer', async () => {
      await db.image.create({ data: { url: 'url', fingerprint: 'fingerprint', width: 10, height: 20 }})
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

      await db.image.create({ data: { url: 'url', fingerprint: 'fingerprint', width: 10, height: 20 }})
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

  describe(nameof(ChannelStore, 'tryGetYoutubeChannelWithLatestInfo'), () => {
    test('Returns the specified channel', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          imageUrl: 'imageUrl',
          isVerified: false,
          name: 'name',
          time: data.time1,
          image: { create: { url: 'url', fingerprint: 'fingerprint', width: 10, height: 20 }}
        }}
      }})

      const result = await channelStore.tryGetYoutubeChannelWithLatestInfo('externalId')

      expect(result).toEqual(expectObjectDeep(result, {
        youtubeId: 'externalId',
        globalInfoHistory: [{ name: 'name', imageUrl: 'imageUrl', isVerified: false, time: data.time1 }]
      }))
    })

    test(`Returns null if the specified channel doesn't exist`, async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          imageUrl: 'imageUrl',
          isVerified: false,
          name: 'name',
          time: data.time1,
          image: { create: { url: 'url', fingerprint: 'fingerprint', width: 10, height: 20 }}
        }}
      }})

      const result = await channelStore.tryGetYoutubeChannelWithLatestInfo('unknownId')

      expect(result).toBeNull()
    })
  })

  describe(nameof(ChannelStore, 'tryGetTwitchChannelWithLatestInfo'), () => {
    test('Returns the specified channel', async () => {
      await db.twitchChannel.create({ data: {
        twitchId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          colour: '',
          displayName: 'Name',
          userName: 'name',
          time: data.time1,
          userType: 'type'
        }}
      }})

      const result = await channelStore.tryGetTwitchChannelWithLatestInfo('externalId')

      expect(result).toEqual(expectObjectDeep(result, {
        twitchId: 'externalId',
        globalInfoHistory: [{ displayName: 'Name', userName: 'name', time: data.time1 }]
      }))
    })

    test(`Returns null if the specified channel doesn't exist`, async () => {
      await db.twitchChannel.create({ data: {
        twitchId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          colour: '',
          displayName: 'Name',
          userName: 'name',
          time: data.time1,
          userType: 'type'
        }}
      }})

      const result = await channelStore.tryGetTwitchChannelWithLatestInfo('unknownId')

      expect(result).toBeNull()
    })
  })

  describe(nameof(ChannelStore, 'updateYoutubeChannel_Global'), () => {
    test('Updates the global info with the same image', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          imageUrl: 'imageUrl',
          isVerified: false,
          name: 'name',
          time: data.time1,
          image: { create: { url: 'url', fingerprint: 'fingerprint', width: 10, height: 20 }}
        }}
      }})
      const channelInfo: SafeOmit<CreateOrUpdateGlobalYoutubeChannelArgs, 'imageId'> = { time: data.time2, name: 'name', imageUrl: 'imageUrl2', isVerified: false }

      const result = await channelStore.updateYoutubeChannel_Global('externalId', channelInfo, 1, null)

      expect(result.globalInfoHistory[0].name).toBe(channelInfo.name)
      expect(result.globalInfoHistory[0].time).toEqual(channelInfo.time)
      await expectRowCount(db.youtubeChannelGlobalInfo).toEqual(2)
    })

    test('Updates the global info with a new image', async () => {
      await db.youtubeChannel.create({ data: {
        youtubeId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          imageUrl: 'imageUrl',
          isVerified: false,
          name: 'name',
          time: data.time1,
          image: { create: { url: 'url', fingerprint: 'fingerprint', width: 10, height: 20 }}
        }}
      }})
      const onGetImageInfo = (channelId: number, channelGlobalInfoId: number) => Promise.resolve<ImageInfo>({
        relativeImageUrl: `${channelId}/${channelGlobalInfoId}.png`,
        imageHeight: 20,
        imageWidth: 40
      })
      const channelInfo: SafeOmit<CreateOrUpdateGlobalYoutubeChannelArgs, 'imageId'> = { time: data.time2, name: 'name', imageUrl: 'imageUrl2', isVerified: false }

      const result = await channelStore.updateYoutubeChannel_Global('externalId', channelInfo, 1, onGetImageInfo)

      expect(result.globalInfoHistory[0].name).toBe(channelInfo.name)
      expect(result.globalInfoHistory[0].time).toEqual(channelInfo.time)
      expect(result.globalInfoHistory[0].imageId).toBe(2)
      await expectRowCount(db.youtubeChannelGlobalInfo, db.image).toEqual([2, 2])
    })
  })

  describe(nameof(ChannelStore, 'updateYoutubeChannel_Streamer'), () => {
    test('Updates the streamer info', async () => {
      await db.streamer.create({ data: { registeredUser: { create: {
        hashedPassword: 'password', username: 'username', aggregateChatUser: { create: {}}
      }}}})
      await db.youtubeChannel.create({ data: {
        youtubeId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          imageUrl: 'imageUrl',
          isVerified: false,
          name: 'name',
          time: data.time1,
          image: { create: { url: 'url', fingerprint: 'fingerprint', width: 10, height: 20 }}
        }}
      }})
      const channelInfo: CreateOrUpdateStreamerYoutubeChannelArgs = { time: data.time2, streamerId: 1, isModerator: true, isOwner: false }

      await channelStore.updateYoutubeChannel_Streamer('externalId', channelInfo)

      await expectRowCount(db.youtubeChannelStreamerInfo).toEqual(1)
    })
  })

  describe(nameof(ChannelStore, 'updateTwitchChannel_Global'), () => {
    test('Updates the global info', async () => {
      await db.twitchChannel.create({ data: {
        twitchId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          colour: '',
          displayName: 'Name',
          userName: 'name',
          time: data.time1,
          userType: 'type'
        }}
      }})
      const channelInfo: CreateOrUpdateGlobalTwitchChannelArgs = { time: data.time2, colour: '', userType: '', userName: 'name', displayName: 'NAME' }

      const result = await channelStore.updateTwitchChannel_Global('externalId', channelInfo)

      expect(result.globalInfoHistory[0].displayName).toBe(channelInfo.displayName)
      expect(result.globalInfoHistory[0].time).toEqual(channelInfo.time)
      await expectRowCount(db.twitchChannelGlobalInfo).toEqual(2)
    })
  })

  describe(nameof(ChannelStore, 'updateTwitchChannel_Streamer'), () => {
    test('Updates the streamer info', async () => {
      await db.streamer.create({ data: { registeredUser: { create: {
        hashedPassword: 'password', username: 'username', aggregateChatUser: { create: {}}
      }}}})
      await db.twitchChannel.create({ data: {
        twitchId: 'externalId',
        user: { create: {}},
        globalInfoHistory: { create: {
          colour: '',
          displayName: 'Name',
          userName: 'name',
          time: data.time1,
          userType: 'type'
        }}
      }})
      const channelInfo: CreateOrUpdateStreamerTwitchChannelArgs = { time: data.time2, streamerId: 1, isVip: false, isSubscriber: false, isBroadcaster: true, isMod: false }

      await channelStore.updateTwitchChannel_Streamer('externalId', channelInfo)

      await expectRowCount(db.twitchChannelStreamerInfo).toEqual(1)
    })
  })
}
