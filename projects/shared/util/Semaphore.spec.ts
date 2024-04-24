import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { sleep } from '@rebel/shared/util/node'

// these tests are not nice and can probably be improved by creating promises and resolving them at strategic times. *yawn* anyway..

let i: number
let groupedSemaphore: GroupedSemaphore<string>

beforeEach(() => {
  i = 0

  groupedSemaphore = new GroupedSemaphore<string>(1, null)
})

describe(GroupedSemaphore.name, () => {
  test('Two separate requests to the same group are executed immediately', async () => {
    await incrementer('test', 100, 0)
    await incrementer('test', 100, 1)
  })

  test('Two simultaneous requests to the same group are executed one-by-one', async () => {
    await Promise.all([incrementer('test', 100, 0), incrementer('test', 1, 1)])
  })

  test('Two simultaneous requests to different groups are executed immediately', async () => {
    await Promise.all([incrementer('test1', 100, 1), incrementer('test2', 1, 0)])
  })
})

async function incrementer (groupName: string, sleepTime: number, expectedI: number) {
  await groupedSemaphore.enter(groupName)
  await sleep(sleepTime)
  expect(i).toBe(expectedI)
  i++
  groupedSemaphore.exit(groupName)
}
