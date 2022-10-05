import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import ViewershipStore, { VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER, VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE } from '@rebel/server/stores/ViewershipStore'
import { getGetterMock, mockGetter, nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'
import { mock, MockProxy } from 'jest-mock-extended'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { LiveViewers } from '@prisma/client'

/** ext. ids channel1, twitchChannel3 */
const user1 = 1
/** ext. ids channel2, twitchChannel4 */
const user2 = 2

const activeLivestream = data.livestream3

export default () => {
  let mockLivestreamStore: MockProxy<LivestreamStore>
  let viewershipStore: ViewershipStore
  let db: Db

  /** Well outside the livestream 3 start/end boundaries */
  const safeMsgTime3 = addTime(data.time3, 'minutes', 45)

  beforeEach(async () => {
    mockLivestreamStore = mock<LivestreamStore>()
    mockLivestreamStore.getActiveLivestream.mockResolvedValue(activeLivestream)

    const dbProvider = await startTestDb()
    viewershipStore = new ViewershipStore(new Dependencies({
      dbProvider,
      livestreamStore: mockLivestreamStore,
      logService: mock()
    }))
    db = dbProvider.get()

    await db.livestream.createMany({ data: [
      { liveId: 'id1', continuationToken: null, start: data.time1, createdAt: data.time1, isActive: false, type: 'publicLivestream' },
      { liveId: 'id2', continuationToken: null, start: data.time2, createdAt: data.time2, isActive: false, type: 'publicLivestream' },
      { liveId: 'id3', continuationToken: null, start: data.time3, createdAt: data.time3, isActive: true, type: 'publicLivestream' }
    ]})
    await db.chatUser.createMany({ data: [{}, {}]})
    await db.youtubeChannel.createMany({ data: [{ userId: user1, youtubeId: data.youtubeChannel1 }, { userId: user2, youtubeId: data.youtubeChannel2 }]})
    await db.twitchChannel.createMany({ data: [{ userId: user1, twitchId: data.twitchChannel3 }, { userId: user2, twitchId: data.twitchChannel4 }]})

    // irrelevant data to make for more realistic setup - we only test things relating to channel1/twitchChannel3/user1
    await db.viewingBlock.createMany({ data: [
      { userId: 2, livestreamId: 2, startTime: data.time2, lastUpdate: data.time2 },
      { userId: 2, livestreamId: 3, startTime: data.time3, lastUpdate: data.time3 },
    ]})
    await db.chatMessage.createMany({ data: [
      { userId: 2, livestreamId: 1, time: data.time1, externalId: 'id1.1' },
      { userId: 2, livestreamId: 2, time: data.time2, externalId: 'id2.1' },
      { userId: 2, livestreamId: 2, time: addTime(data.time2, 'seconds', 1), externalId: 'id3.1' },
    ]})
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(ViewershipStore, 'addLiveViewCount'), () => {
    test('correctly adds live viewer count', async () => {
      const youtubeViews = 5
      const twitchViews = 2

      await viewershipStore.addLiveViewCount(youtubeViews, twitchViews)

      const dbContents = await db.liveViewers.findFirst()
      expect(dbContents).toEqual(expect.objectContaining<Partial<LiveViewers>>({
        livestreamId: data.livestream3.id,
        youtubeViewCount: youtubeViews,
        twitchViewCount: twitchViews
      }))
    })
  })

  describe(nameof(ViewershipStore, 'addViewershipForChatParticipation'), () => {
    test('adds new viewing block if user not seen before', async () => {
      await viewershipStore.addViewershipForChatParticipation(user1, safeMsgTime3.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { user: { id: user1 }}}))!
      expect(block.startTime).toEqual(addTime(safeMsgTime3, 'minutes', -VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE))
      expect(block.lastUpdate).toEqual(addTime(safeMsgTime3, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER))
    })

    test('trims viewing block to fit into livestream times', async () => {
      const start = addTime(data.time3, 'minutes', -1)
      const end = addTime(data.time3, 'minutes', 1)
      mockLivestreamStore.getActiveLivestream.mockResolvedValue({ ...data.livestream3, start, end })

      await viewershipStore.addViewershipForChatParticipation(user1, data.time3.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { user: { id: user1 }}}))!
      expect(block.startTime).toEqual(start)
      expect(block.lastUpdate).toEqual(end)
    })

    test('extends previous viewing block if recent', async () => {
      const currentTime = safeMsgTime3
      const prevUpdate = addTime(currentTime, 'minutes', -2)
      const startTime = addTime(prevUpdate, 'minutes', -15)
      await db.viewingBlock.create({ data: {
        livestream: { connect: { id: activeLivestream.id }},
        user: { connect: { id: user1 }},
        startTime,
        lastUpdate: prevUpdate
      }})

      await viewershipStore.addViewershipForChatParticipation(user1, currentTime.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { user: { id: user1 }}}))!
      expect(block.startTime).toEqual(startTime)
      expect(block.lastUpdate).toEqual(addTime(currentTime, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER))
    })

    test('adds new viewing block if previous block is too long ago', async () => {
      const currentTime = safeMsgTime3
      const prevUpdate = addTime(currentTime, 'minutes', -30)
      const startTime = addTime(prevUpdate, 'minutes', -15)
      await db.viewingBlock.create({ data: {
        livestream: { connect: { id: activeLivestream.id }},
        user: { connect: { id: user1 }},
        startTime,
        lastUpdate: prevUpdate
      }})

      await viewershipStore.addViewershipForChatParticipation(user1, currentTime.getTime())

      await expectRowCount(db.viewingBlock).toBe(4)
      const block = (await db.viewingBlock.findFirst({
        where: { user: { id: user1 }},
        orderBy: { lastUpdate: 'desc' }
      }))!
      expect(block.startTime).toEqual(addTime(currentTime, 'minutes', -VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE))
      expect(block.lastUpdate).toEqual(addTime(currentTime, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER))
    })

    test('ignores if before lastUpdate of most recent viewing block', async () => {
      const currentTime = safeMsgTime3
      const prevUpdate = addTime(currentTime, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER + 5)
      const startTime = addTime(prevUpdate, 'minutes', -15)
      await db.viewingBlock.create({ data: {
        livestream: { connect: { id: activeLivestream.id }},
        user: { connect: { id: user1 }},
        startTime,
        lastUpdate: prevUpdate
      }})

      await viewershipStore.addViewershipForChatParticipation(user1, currentTime.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { user: { id: user1 }}}))!
      expect(block.startTime).toEqual(startTime)
      expect(block.lastUpdate).toEqual(prevUpdate)
    })
  })

  describe(nameof(ViewershipStore, 'getLastSeen'), () => {
    test('returns null if never seen', async () => {
      // note: the test db doesn't contain viewing blocks for this user

      const result = await viewershipStore.getLastSeen(user1)

      expect(result).toBeNull()
    })

    test('returns time of correct viewing block', async () => {
      // 3 streams. viewer block in stream 1 and two in stream 3
      const time1 = data.time1
      const time2 = addTime(time1, 'seconds', 1)
      const time3 = data.time3
      const time4 = addTime(time3, 'seconds', 1)
      const time5 = addTime(time4, 'seconds', 1)
      const time6 = addTime(time5, 'seconds', 1)
      await db.viewingBlock.createMany({ data: [
        { userId: user1, livestreamId: 1, startTime: time1, lastUpdate: time2 },
        { userId: user1, livestreamId: 3, startTime: time3, lastUpdate: time4 },
        { userId: user1, livestreamId: 3, startTime: time5, lastUpdate: time6 },
      ]})

      const result = await viewershipStore.getLastSeen(user1)

      expect(result!.livestream.id).toBe(3)
      expect(result!.time).toEqual(time6)
    })
  })

  describe(nameof(ViewershipStore, 'getLatestLiveCount'), () => {
    test('returns null if no data exists for active livestream', async () => {
      await db.liveViewers.create({ data: {
        livestream: { connect: { liveId: 'id1' }},
        youtubeViewCount: 2,
        twitchViewCount: 5
      }})

      const result = await viewershipStore.getLatestLiveCount()

      expect(result).toBeNull()
    })

    test('returns null if there is no active livestream', async () => {
      mockLivestreamStore.getActiveLivestream.mockResolvedValue(null)

      const result = await viewershipStore.getLatestLiveCount()

      expect(result).toBeNull()
    })

    test('returns correct count and time for active livestream', async () => {
      const data1 = { time: data.time1, viewCount: 1, twitchViewCount: 3 }
      const data2 = { time: data.time2, viewCount: 2, twitchViewCount: 4 }
      await db.liveViewers.create({ data: {
        livestream: { connect: { liveId: 'id3' }},
        youtubeViewCount: data1.viewCount,
        twitchViewCount: data1.twitchViewCount,
        time: data1.time
      }})
      await db.liveViewers.create({ data: {
        livestream: { connect: { liveId: 'id3' }},
        youtubeViewCount: data2.viewCount,
        twitchViewCount: data2.twitchViewCount,
        time: data2.time
      }})

      const result = await viewershipStore.getLatestLiveCount()

      expect(result).toEqual(data2)
    })
  })

  describe(nameof(ViewershipStore, 'getLivestreamParticipation'), () => {
    test('returns empty array if no participation', async () => {
      const result = await viewershipStore.getLivestreamParticipation(user1)

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.participated).length).toBe(0)
    })

    test('does not include chat messages not attached to a public livestream', async () => {
      await db.chatMessage.createMany({ data: [
        { userId: user1, livestreamId: 1, time: data.time1, externalId: 'id1' },
        { userId: user1, livestreamId: null, time: addTime(data.time1, 'seconds', 1), externalId: 'id2' }
      ]})

      const result = await viewershipStore.getLivestreamParticipation(user1)

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1}))
      expect(result[1]).toEqual(expect.objectContaining({ participated: false, id: 2}))
      expect(result[2]).toEqual(expect.objectContaining({ participated: false, id: 3}))
    })

    test('returns ordered streams where user participated', async () => {
      // 2 messages in stream 1, 0 messages in stream 2, 1 message in stream 3
      await db.chatMessage.createMany({ data: [
        { userId: user1, livestreamId: 1, time: data.time1, externalId: 'id1' },
        { userId: user1, livestreamId: 1, time: addTime(data.time1, 'seconds', 1), externalId: 'id2' },
        { userId: user1, livestreamId: 3, time: data.time3, externalId: 'id3' },
      ]})

      const result = await viewershipStore.getLivestreamParticipation(user1)

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1}))
      expect(result[1]).toEqual(expect.objectContaining({ participated: false, id: 2}))
      expect(result[2]).toEqual(expect.objectContaining({ participated: true, id: 3}))
    })
  })

  describe(nameof(ViewershipStore, 'getLivestreamViewership'), () => {
    test('returns empty array if no viewership', async () => {
      const result = await viewershipStore.getLivestreamViewership(user1)

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.viewed).length).toBe(0)
    })

    test('returns ordered streams where user participated', async () => {
      // 2 viewing blocks in stream 1, 0 blocks in stream 2, 1 block in stream 3
      const time1 = data.time1
      const time2 = addTime(data.time1, 'seconds', 1)
      const time3 = data.time3
      await db.viewingBlock.createMany({ data: [
        { userId: user1, livestreamId: 1, startTime: time1, lastUpdate: time1 },
        { userId: user1, livestreamId: 1, startTime: time2, lastUpdate: time2 },
        { userId: user1, livestreamId: 3, startTime: time3, lastUpdate: time3 },
      ]})

      const result = await viewershipStore.getLivestreamViewership(user1)

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ viewed: true, id: 1}))
      expect(result[1]).toEqual(expect.objectContaining({ viewed: false, id: 2}))
      expect(result[2]).toEqual(expect.objectContaining({ viewed: true, id: 3}))
    })
  })
}
