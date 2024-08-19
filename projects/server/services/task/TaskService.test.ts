import { Task } from '@prisma/client'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import CleanUpYoutubeContextTokensTask from '@rebel/server/services/task/CleanUpYoutubeContextTokensTask'
import TaskService from '@rebel/server/services/task/TaskService'
import TaskStore from '@rebel/server/stores/TaskStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { MockProxy, mock } from 'jest-mock-extended'

let mockCleanUpYoutubeContextTokensTask: MockProxy<CleanUpYoutubeContextTokensTask>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let mockTaskStore: MockProxy<TaskStore>
let mockTimerHelpers: MockProxy<TimerHelpers>
let taskService: TaskService

beforeEach(() => {
  mockCleanUpYoutubeContextTokensTask = mock()
  mockDateTimeHelpers = mock()
  mockTaskStore = mock()
  mockTimerHelpers = mock()

  taskService = new TaskService(new Dependencies({
    cleanUpYoutubeContextTokensTask: mockCleanUpYoutubeContextTokensTask,
    dateTimeHelpers: mockDateTimeHelpers,
    logService: mock(),
    taskStore: mockTaskStore,
    timerHelpers: mockTimerHelpers
  }))
})

describe(nameof(TaskService, 'initialise'), () => {
  test('Schedules the task according to the interval', async () => {
    const intervalMs = 500
    const now = 10000
    const lastExecutionTime = now - 100
    mockDateTimeHelpers.ts.calledWith().mockReturnValue(now)
    mockTaskStore.getTask.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(cast<Task>({ intervalMs }))
    mockTaskStore.getTimeSinceLastTaskExecution.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(lastExecutionTime)

    await taskService.initialise()

    const timeoutAmount = single(mockTimerHelpers.setTimeout.mock.calls)[1]
    expect(timeoutAmount).toBe(lastExecutionTime + intervalMs - now)
  })

  test('Schedules the task immediately if the task has not been executed previously', async () => {
    const intervalMs = 500
    const now = 10000
    mockDateTimeHelpers.ts.calledWith().mockReturnValue(now)
    mockTaskStore.getTask.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(cast<Task>({ intervalMs }))
    mockTaskStore.getTimeSinceLastTaskExecution.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(null)

    await taskService.initialise()

    const timeoutAmount = single(mockTimerHelpers.setTimeout.mock.calls)[1]
    expect(timeoutAmount).toBe(0)
  })

  test('Successful task is handled correctly', async () => {
    const intervalMs = 500
    const now = 10000
    mockDateTimeHelpers.ts.calledWith().mockReturnValue(now)
    mockTaskStore.getTask.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(cast<Task>({ intervalMs }))

    await taskService.initialise()

    const timeoutFn = single(mockTimerHelpers.setTimeout.mock.calls)[0]

    // now test the task execution mechanics
    const valueToLog = 'value to log'
    const taskLogId = 25
    mockCleanUpYoutubeContextTokensTask.execute.calledWith(expect.anything()).mockResolvedValue(valueToLog)
    mockTaskStore.startTask.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(taskLogId)
    mockTimerHelpers.setTimeout.mockReset()

    await timeoutFn()

    const endTaskCall = single(mockTaskStore.endTask.mock.calls)
    expect(endTaskCall).toEqual<typeof endTaskCall>([taskLogId, valueToLog])

    expect(mockTaskStore.failTask.mock.calls.length).toBe(0)

    // we should have rescheduled the task
    const timeoutAmount = single(mockTimerHelpers.setTimeout.mock.calls)[1]
    expect(timeoutAmount).toBe(intervalMs)
  })

  test('Failing task is handled correctly', async () => {
    const intervalMs = 500
    const now = 10000
    mockDateTimeHelpers.ts.calledWith().mockReturnValue(now)
    mockTaskStore.getTask.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(cast<Task>({ intervalMs }))

    await taskService.initialise()

    const timeoutFn = single(mockTimerHelpers.setTimeout.mock.calls)[0]

    // now test the task execution mechanics
    const taskLogId = 25
    const error = 'test error'
    mockCleanUpYoutubeContextTokensTask.execute.calledWith(expect.anything()).mockRejectedValue(new Error(error))
    mockTaskStore.startTask.calledWith('cleanUpYoutubeContextTokensTask').mockResolvedValue(taskLogId)
    mockTimerHelpers.setTimeout.mockReset()

    await timeoutFn()

    expect(mockTaskStore.endTask.mock.calls.length).toBe(0)

    const endTaskCall = single(mockTaskStore.failTask.mock.calls)
    expect(endTaskCall).toEqual<typeof endTaskCall>([taskLogId, '', error])

    // we should have rescheduled the task
    const timeoutAmount = single(mockTimerHelpers.setTimeout.mock.calls)[1]
    expect(timeoutAmount).toBe(intervalMs)
  })
})
