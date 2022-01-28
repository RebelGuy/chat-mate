import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import { expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import ViewershipStore, { VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER, VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE } from '@rebel/server/stores/ViewershipStore'
import { getGetterMock, mockGetter, nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'
import { mock, MockProxy } from 'jest-mock-extended'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'

export default () => {
  let mockLivestreamStore: MockProxy<LivestreamStore>
  let viewershipStore: ViewershipStore
  let db: Db

  /** Well outside the livestream 3 start/end boundaries */
  const safeMsgTime3 = addTime(data.time3, 'minutes', 45)

  beforeEach(async () => {
    mockLivestreamStore = mock<LivestreamStore>()
    mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(data.livestream3)

    const dbProvider = await startTestDb()
    viewershipStore = new ViewershipStore(new Dependencies({
      dbProvider,
      livestreamStore: mockLivestreamStore
    }))
    db = dbProvider.get()

    await db.livestream.createMany({ data: [
      { liveId: 'id1', continuationToken: null, start: data.time1, createdAt: data.time1 },
      { liveId: 'id2', continuationToken: null, start: data.time2, createdAt: data.time2 },
      { liveId: 'id3', continuationToken: null, start: data.time3, createdAt: data.time3 }
    ]})
    await db.channel.createMany({ data: [{ youtubeId: data.channel1 }, { youtubeId: data.channel2 }]})

    // irrelevant data to make for more realistic setup - we only test things relating to channel1
    await db.viewingBlock.createMany({ data: [
      { channelId: 2, livestreamId: 2, startTime: data.time2, lastUpdate: data.time2 },
      { channelId: 2, livestreamId: 3, startTime: data.time3, lastUpdate: data.time3 },
    ]})
    await db.chatMessage.createMany({ data: [
      { channelId: 2, livestreamId: 1, time: data.time1, youtubeId: 'id1.1' },
      { channelId: 2, livestreamId: 2, time: data.time2, youtubeId: 'id2.1' },
      { channelId: 2, livestreamId: 2, time: addTime(data.time2, 'seconds', 1), youtubeId: 'id3.1' },
    ]})
  })

  afterEach(stopTestDb)

  describe(nameof(ViewershipStore, 'addLiveViewCount'), () => {
    test('correctly adds live viewer count', async () => {
      const viewCount = 5

      await viewershipStore.addLiveViewCount(viewCount)

      const dbContents = (await db.liveViewers.findFirst())!
      expect(dbContents).toEqual(expect.objectContaining({ livestreamId: data.livestream3.id, viewCount, time: expect.any(Date) }))
    })
  })

  describe(nameof(ViewershipStore, 'addViewershipForChatParticipation'), () => {
    test('adds new viewing block if user not seen before', async () => {
      await viewershipStore.addViewershipForChatParticipation(data.channel1, safeMsgTime3.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { channel: { youtubeId: data.channel1 }}}))!
      expect(block.startTime).toEqual(addTime(safeMsgTime3, 'minutes', -VIEWING_BLOCK_PARTICIPATION_PADDING_BEFORE))
      expect(block.lastUpdate).toEqual(addTime(safeMsgTime3, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER))
    })

    test('trims viewing block to fit into livestream times', async () => {
      const start = addTime(data.time3, 'minutes', -1)
      const end = addTime(data.time3, 'minutes', 1)
      const livestreamGetter = getGetterMock(mockLivestreamStore, 'currentLivestream')
      livestreamGetter.mockClear()
      livestreamGetter.mockReturnValue({ ...data.livestream3, start, end })

      await viewershipStore.addViewershipForChatParticipation(data.channel1, data.time3.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { channel: { youtubeId: data.channel1 }}}))!
      expect(block.startTime).toEqual(start)
      expect(block.lastUpdate).toEqual(end)
    })

    test('extends previous viewing block if recent', async () => {
      const currentTime = safeMsgTime3
      const prevUpdate = addTime(currentTime, 'minutes', -2)
      const startTime = addTime(prevUpdate, 'minutes', -15)
      await db.viewingBlock.create({ data: {
        livestream: { connect: { id: mockLivestreamStore.currentLivestream.id }},
        channel: { connect: { youtubeId: data.channel1 }},
        startTime,
        lastUpdate: prevUpdate
      }})

      await viewershipStore.addViewershipForChatParticipation(data.channel1, currentTime.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { channel: { youtubeId: data.channel1 }}}))!
      expect(block.startTime).toEqual(startTime)
      expect(block.lastUpdate).toEqual(addTime(currentTime, 'minutes', VIEWING_BLOCK_PARTICIPATION_PADDING_AFTER))
    })

    test('adds new viewing block if previous block is too long ago', async () => {
      const currentTime = safeMsgTime3
      const prevUpdate = addTime(currentTime, 'minutes', -30)
      const startTime = addTime(prevUpdate, 'minutes', -15)
      await db.viewingBlock.create({ data: {
        livestream: { connect: { id: mockLivestreamStore.currentLivestream.id }},
        channel: { connect: { youtubeId: data.channel1 }},
        startTime,
        lastUpdate: prevUpdate
      }})

      await viewershipStore.addViewershipForChatParticipation(data.channel1, currentTime.getTime())

      await expectRowCount(db.viewingBlock).toBe(4)
      const block = (await db.viewingBlock.findFirst({
        where: { channel: { youtubeId: data.channel1 }},
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
        livestream: { connect: { id: mockLivestreamStore.currentLivestream.id }},
        channel: { connect: { youtubeId: data.channel1 }},
        startTime,
        lastUpdate: prevUpdate
      }})

      await viewershipStore.addViewershipForChatParticipation(data.channel1, currentTime.getTime())

      await expectRowCount(db.viewingBlock).toBe(3)
      const block = (await db.viewingBlock.findFirst({ where: { channel: { youtubeId: data.channel1 }}}))!
      expect(block.startTime).toEqual(startTime)
      expect(block.lastUpdate).toEqual(prevUpdate)
    })
  })

  describe(nameof(ViewershipStore, 'getLastSeen'), () => {
    test('returns null if never seen', async () => {
      const result = await viewershipStore.getLastSeen(data.channel1)

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
        { channelId: 1, livestreamId: 1, startTime: time1, lastUpdate: time2 },
        { channelId: 1, livestreamId: 3, startTime: time3, lastUpdate: time4 },
        { channelId: 1, livestreamId: 3, startTime: time5, lastUpdate: time6 },
      ]})

      const result = (await viewershipStore.getLastSeen(data.channel1))!

      expect(result.livestream.id).toBe(3)
      expect(result.time).toEqual(time6)
    })
  })

  describe(nameof(ViewershipStore, 'getLatestLiveCount'), () => {
    test('returns null if no data exists for current livestream', async () => {
      await db.liveViewers.create({ data: {
        livestream: { connect: { liveId: 'id1' }},
        viewCount: 2
      }})

      const result = await viewershipStore.getLatestLiveCount()

      expect(result).toBeNull()
    })

    test('returns correct count and time for current livestream', async () => {
      const data1 = { time: data.time1, viewCount: 1 }
      const data2 = { time: data.time2, viewCount: 2 }
      await db.liveViewers.create({ data: {
        livestream: { connect: { liveId: 'id3' }},
        viewCount: data1.viewCount,
        time: data1.time
      }})
      await db.liveViewers.create({ data: {
        livestream: { connect: { liveId: 'id3' }},
        viewCount: data2.viewCount,
        time: data2.time
      }})

      const result = await viewershipStore.getLatestLiveCount()

      expect(result).toEqual(data2)
    })
  })

  describe(nameof(ViewershipStore, 'getLivestreamParticipation'), () => {
    test('returns empty array if no participation', async () => {
      const result = await viewershipStore.getLivestreamParticipation(data.channel1)

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.participated).length).toBe(0)
    })

    test('returns ordered streams where user participated', async () => {
      // 2 messages in stream 1, 0 messages in stream 2, 1 message in stream 3
      await db.chatMessage.createMany({ data: [
        { channelId: 1, livestreamId: 1, time: data.time1, youtubeId: 'id1' },
        { channelId: 1, livestreamId: 1, time: addTime(data.time1, 'seconds', 1), youtubeId: 'id2' },
        { channelId: 1, livestreamId: 3, time: data.time3, youtubeId: 'id3' },
      ]})

      const result = await viewershipStore.getLivestreamParticipation(data.channel1)

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.participated).length).toBe(2)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1}))
      expect(result[2]).toEqual(expect.objectContaining({ participated: true, id: 3}))
    })
  })

  describe(nameof(ViewershipStore, 'getLivestreamViewership'), () => {
    test('returns empty array if no viewership', async () => {
      const result = await viewershipStore.getLivestreamViewership(data.channel1)

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.viewed).length).toBe(0)
    })

    test('returns ordered streams where user participated', async () => {
      // 2 viewing blocks in stream 1, 0 blocks in stream 2, 1 block in stream 3
      const time1 = data.time1
      const time2 = addTime(data.time1, 'seconds', 1)
      const time3 = data.time3
      await db.viewingBlock.createMany({ data: [
        { channelId: 1, livestreamId: 1, startTime: time1, lastUpdate: time1 },
        { channelId: 1, livestreamId: 1, startTime: time2, lastUpdate: time2 },
        { channelId: 1, livestreamId: 3, startTime: time3, lastUpdate: time3 },
      ]})

      const result = await viewershipStore.getLivestreamViewership(data.channel1)

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.viewed).length).toBe(2)
      expect(result[0]).toEqual(expect.objectContaining({ viewed: true, id: 1}))
      expect(result[2]).toEqual(expect.objectContaining({ viewed: true, id: 3}))
    })
  })
}
