import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { setupTestDb } from '@rebel/server/_test/db'

let channelStore: ChannelStore
let db: Db
const reset = async () => {
  const dbProvider = await setupTestDb()
  channelStore = new ChannelStore(new Dependencies({ dbProvider }))
  db = dbProvider.get()
}
beforeEach(reset)

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
