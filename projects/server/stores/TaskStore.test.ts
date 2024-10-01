import { Task } from '@prisma/client'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import TaskStore from '@rebel/server/stores/TaskStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'
import { DbError, NotFoundError } from '@rebel/shared/util/error'
import * as data from '@rebel/server/_test/testData'

const tasks: Task[] = [
  { id: 1, intervalMs: 123, taskType: 'cleanUpYoutubeContextTokensTask' },
  { id: 2, intervalMs: 456, taskType: 'cleanUpApiCallsTask' }
]

export default () => {
  let db: Db
  let taskStore: TaskStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    taskStore = new TaskStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()

    await db.task.createMany({ data: tasks})
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(TaskStore, 'getTask'), () => {
    test('Returns the specified task', async () => {
      const result = await taskStore.getTask('cleanUpYoutubeContextTokensTask')

      expect(result.id).toBe(tasks[0].id)
    })
  })

  describe(nameof(TaskStore, 'getAllTasks'), () => {
    test('Returns all tasks', async () => {
      const result = await taskStore.getAllTasks()

      expect(result).toEqual(tasks)
    })
  })

  describe(nameof(TaskStore, 'updateTask'), () => {
    test('Updates the interval of the specified task', async () => {
      await taskStore.updateTask(tasks[1].taskType, 999)

      const storedTasks = await db.task.findMany()
      expect(storedTasks.map(t => t.intervalMs)).toEqual([tasks[0].intervalMs, 999])
    })
  })

  describe(nameof(TaskStore, 'getTaskTypes'), () => {
    test('Returns the list of task types available in the database', async () => {
      const result = await taskStore.getTaskTypes()

      expect(result).toEqual(tasks.map(t => t.taskType))
    })
  })

  describe(nameof(TaskStore, 'getLastExecutionTime'), () => {
    test('Returns the timestamp of the last execution', async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time1, endTime: data.time2, taskId: 1 },
        { startTime: data.time3, endTime: data.time4, taskId: 1 }
      ]})

      const result = await taskStore.getLastExecutionTime(tasks[0].taskType)

      expect(result).toBe(data.time3.getTime())
    })

    test('Returns null if the task was never executed', async () => {
      const result = await taskStore.getLastExecutionTime(tasks[0].taskType)

      expect(result).toBeNull()
    })
  })

  describe(nameof(TaskStore, 'getLastSuccessTime'), () => {
    test('Returns the timestamp of the last successful execution', async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time1, endTime: data.time2, taskId: 1 },
        { startTime: data.time3, endTime: data.time4, taskId: 1 },
        { startTime: data.time5, endTime: data.time5, taskId: 1, errorMessage: 'error' },
        { startTime: data.time5, endTime: data.time5, taskId: 2 }
      ]})

      const result = await taskStore.getLastSuccessTime(tasks[0].taskType)

      expect(result).toBe(data.time3.getTime())
    })

    test('Returns null if the task never succeeded', async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time5, endTime: data.time5, taskId: 1, errorMessage: 'error' },
        { startTime: data.time5, endTime: data.time5, taskId: 2 }
      ]})

      const result = await taskStore.getLastSuccessTime(tasks[0].taskType)

      expect(result).toBeNull()
    })
  })

  describe(nameof(TaskStore, 'getLastFailureTime'), () => {
    test('Returns the timestamp of the last failed execution', async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time1, endTime: data.time2, taskId: 1, errorMessage: 'error' },
        { startTime: data.time3, endTime: data.time4, taskId: 1, errorMessage: 'error' },
        { startTime: data.time5, endTime: data.time5, taskId: 1 },
        { startTime: data.time5, endTime: data.time5, taskId: 2 }
      ]})

      const result = await taskStore.getLastFailureTime(tasks[0].taskType)

      expect(result).toBe(data.time3.getTime())
    })

    test('Returns null if the task never failed', async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time5, endTime: data.time5, taskId: 1 },
        { startTime: data.time5, endTime: data.time5, taskId: 2 }
      ]})

      const result = await taskStore.getLastFailureTime(tasks[0].taskType)

      expect(result).toBeNull()
    })
  })

  describe(nameof(TaskStore, 'getTaskLogs'), () => {
    test('Returns the task logs of the specified task', async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time1, endTime: data.time2, taskId: 1, errorMessage: 'error' },
        { startTime: data.time5, endTime: data.time5, taskId: 1 },
        { startTime: data.time5, endTime: data.time5, taskId: 2 }
      ]})

      const result = await taskStore.getTaskLogs(tasks[0].taskType)

      expect(result.length).toBe(2)
    })
  })

  describe(nameof(TaskStore, 'startTask'), () => {
    test('Adds a new entry to the db', async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time1, endTime: data.time2, taskId: 1 },
        { startTime: data.time3, endTime: data.time4, taskId: 1 }
      ]})

      const result = await taskStore.startTask('cleanUpYoutubeContextTokensTask')

      const storedTaskLog = await db.taskLog.findUnique({ where: { id: result } })
      expect(storedTaskLog).toEqual<typeof storedTaskLog>({
        id: result,
        startTime: expect.any(Date),
        endTime: null,
        errorMessage: null,
        log: null,
        taskId: 1
      })
    })
  })

  describe(nameof(TaskStore, 'endTask'), () => {
    test(`Updates the existing entry's end time`, async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time1, endTime: data.time2, taskId: 1 },
        { startTime: data.time3, endTime: null, taskId: 1 }
      ]})
      const log = 'test'

      await taskStore.endTask(2, log)

      const storedTaskLog = await db.taskLog.findUnique({ where: { id: 2 } })
      expect(storedTaskLog).toEqual<typeof storedTaskLog>({
        id: 2,
        startTime: data.time3,
        endTime: expect.any(Date),
        errorMessage: null,
        log: log,
        taskId: 1
      })
    })
  })

  describe(nameof(TaskStore, 'failTask'), () => {
    test(`Updates the existing entry's end time and error message`, async () => {
      await db.taskLog.createMany({ data: [
        { startTime: data.time1, endTime: data.time2, taskId: 1 },
        { startTime: data.time3, endTime: null, taskId: 1 }
      ]})
      const log = 'test'
      const error = 'error'

      await taskStore.failTask(2, log, error)

      const storedTaskLog = await db.taskLog.findUnique({ where: { id: 2 } })
      expect(storedTaskLog).toEqual<typeof storedTaskLog>({
        id: 2,
        startTime: data.time3,
        endTime: expect.any(Date),
        errorMessage: error,
        log: log,
        taskId: 1
      })
    })
  })
}
