import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore, { CreateOrUpdateChannelArgs } from '@rebel/server/stores/ChannelStore'
import { expectRowCount, setupTestDb } from '@rebel/server/_test/db'
import { single } from '@rebel/server/_test/utils'

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

let channelStore: ChannelStore
let db: Db
beforeEach(async () => {
  const dbProvider = await setupTestDb()
  channelStore = new ChannelStore(new Dependencies({ dbProvider }))
  db = dbProvider.get()
})

describe(ChannelStore.prototype.exists, () => {
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

describe(ChannelStore.prototype.createOrUpdate, () => {
  // set up the database with sample data
  const nChannel = 2
  const nInfo = 3
  beforeEach(async () => {
    await db.channel.create({ data: {
      youtubeId: 'channel1',
      infoHistory: { createMany: { data: [channelInfo1, channelInfo2]} } 
    }})
    await db.channel.create({ data: {
      youtubeId: 'channel2',
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
    const result = await channelStore.createOrUpdate('channel2', channelInfo4)
    
    expect(result.youtubeId).toBe('channel2')
    expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo4))
    await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo + 1])
  })

  test('stale channel info skips db update', async () => {
    const modifiedInfo2 = {
      ...channelInfo2,
      time: new Date(2021, 1, 3)
    }

    const result = await channelStore.createOrUpdate('channel1', modifiedInfo2)

    expect(result.youtubeId).toBe('channel1')
    expect(single(result.infoHistory)).toEqual(expect.objectContaining(channelInfo2))
    await expectRowCount(db.channel, db.channelInfo).toEqual([nChannel, nInfo])
  })
})
