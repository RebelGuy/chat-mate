require('module-alias/register')
import { DB } from '@rebel/server/scripts/consts'

// run using one of the following:
// yarn workspace server snapshot:debug
// yarn workspace server snapshot:release

const main = async () => {
  const deleted = await DB.experienceSnapshot.deleteMany()
  console.log(`Successfully deleted ${deleted.count} entries.`)

  const result = await DB.experienceTransaction.groupBy({
    by: ['userId'],
    _sum: { delta: true }
  })
  console.log(`Successfully retrieved experience data for ${result.length} users.`)

  await Promise.all(result.map(r => createSnapshot(r.userId, r._sum.delta ?? 0)))
  console.log(`Successfully created new snapshots.`)

  const totalTransaction = (await DB.experienceTransaction.aggregate({ _sum: { delta: true }}))._sum.delta
  const totalSnapshot = (await DB.experienceSnapshot.aggregate({ _sum: { experience: true }}))._sum.experience
  if (totalTransaction === totalSnapshot) {
    console.log(`Successfully verified data integrity.`)
  } else {
    throw new Error(`Total transaction experience (${totalTransaction}) is different from the total snapshot experience (${totalSnapshot}).`)
  }
}

async function createSnapshot (userId: number, experience: number) {
  await DB.experienceSnapshot.create({data: {
    userId,
    experience,
    time: new Date()
  }})
}

main()
  .then(() => { /* success */ })
  .catch(e => console.error('Error refreshing snapshots.', e))
