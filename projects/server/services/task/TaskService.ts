import { Task, TaskType } from '@prisma/client'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'
import LogService from '@rebel/server/services/LogService'
import CleanUpApiCallsTask from '@rebel/server/services/task/CleanUpApiCallsTask'
import CleanUpYoutubeContextTokensTask from '@rebel/server/services/task/CleanUpYoutubeContextTokensTask'
import TaskStore from '@rebel/server/stores/TaskStore'
import { LogContext, createLogContext } from '@rebel/shared/ILogService'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { ChatMateError } from '@rebel/shared/util/error'
import { NO_OP } from '@rebel/shared/util/typescript'

/** A potentially long-running task that is automatically scheduled periodically. */
export interface ITask {
  /** `onLog` should be called for each line of log that should be appended to the running log, if required. The returned string will also be treated as a line of log to be appended. */
  execute (onLog: (logToAppend: string) => void): Promise<string | null>
}

type Deps = Dependencies<{
  logService: LogService
  taskStore: TaskStore
  dateTimeHelpers: DateTimeHelpers
  timerHelpers: TimerHelpers
  cleanUpYoutubeContextTokensTask: CleanUpYoutubeContextTokensTask
  cleanUpApiCallsTask: CleanUpApiCallsTask
}>

export default class TaskService extends SingletonContextClass {
  public readonly name = TaskService.name

  private readonly logService: LogService
  private readonly taskStore: TaskStore
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly timerHelpers: TimerHelpers

  private tasks: Record<TaskType, ITask>
  private timers: Record<TaskType, () => void>

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.taskStore = deps.resolve('taskStore')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.timerHelpers = deps.resolve('timerHelpers')

    this.tasks = {
      [TaskType.cleanUpYoutubeContextTokensTask]: deps.resolve('cleanUpYoutubeContextTokensTask'),
      [TaskType.cleanUpApiCallsTask]: deps.resolve('cleanUpApiCallsTask')
    }
    this.timers = {
      [TaskType.cleanUpYoutubeContextTokensTask]: NO_OP,
      [TaskType.cleanUpApiCallsTask]: NO_OP
    }
  }

  public override async initialise (): Promise<void> {
    // for testing purposes, we get the task types from the db instead of hardcoding them
    const taskTypes = await this.taskStore.getTaskTypes()
    for (const taskType of taskTypes) {
      const task = await this.taskStore.getTask(taskType)
      const previousTime = await this.taskStore.getLastExecutionTime(taskType) ?? 0
      const newTime = previousTime + task.intervalMs
      const timeout = newTime - this.dateTimeHelpers.ts()

      if (timeout < 0) {
        this.logService.logInfo(this, `Starting task ${taskType} immediately since the last execution time (${previousTime}) is longer ago than the scheduled interval (${task.intervalMs})`)
      } else {
        this.logService.logInfo(this, `Scheduled task ${taskType} for ${newTime} (in ${timeout}ms)`)
      }
      this.timers[taskType] = this.timerHelpers.setTimeout(() => this.executeTask(taskType), timeout > 0 ? timeout : 0)
    }
  }

  public getTaskTypes (): TaskType[] {
    return Object.keys(this.tasks) as TaskType[]
  }

  public async updateTask (taskType: TaskType, intervalMs: number) {
    this.timers[taskType]() // cancel

    await this.taskStore.updateTask(taskType, intervalMs)
    const previousTime = await this.taskStore.getLastExecutionTime(taskType) ?? 0
    const newTime = previousTime + intervalMs
    const timeout = newTime - this.dateTimeHelpers.ts()

    if (timeout < 0) {
      this.logService.logInfo(this, `Updated task ${taskType}. Executing immediately since the last execution time (${previousTime}) is longer ago than the newly scheduled interval (${intervalMs})`)
    } else {
      this.logService.logInfo(this, `Updated task ${taskType}. Scheduled for ${newTime} (in ${timeout}ms)`)
    }
    this.timers[taskType] = this.timerHelpers.setTimeout(() => this.executeTask(taskType), timeout > 0 ? timeout : 0)
  }

  public async executeTask (taskType: TaskType): Promise<void> {
    this.timers[taskType]() // cancel

    const startTime = this.dateTimeHelpers.ts()
    const taskExecutor = new TaskExecutor(createLogContext(this.logService, this), taskType, this.tasks[taskType])

    let taskId: number | null = null
    let task: Task | null = null

    try {
      task = await this.taskStore.getTask(taskType)
      taskId = await this.taskStore.startTask(taskType)

      this.logService.logInfo(this, `[${taskType}]`, `Starting task with log id ${taskId}`)
      const logs = await taskExecutor.execute()
      this.logService.logInfo(this, `[${taskType}]`, `Finished task with log id ${taskId}`)

      await this.taskStore.endTask(taskId, logs)

    } catch (e: any) {
      this.logService.logError(this, `[${taskType}]`, `Failed to execute task with log id ${taskId ?? '<unknown id>'}:`, e)
      if (taskId != null) {
        try {
          await this.taskStore.failTask(taskId, taskExecutor.getLogs(), e.message)
        } catch (innerE: any) {
          this.logService.logError(this, `[${taskType}]`, `Failed to execute task with log id ${taskId} and failed to update database entry:`, innerE)
        }
      }
    }

    if (task == null) {
      throw new ChatMateError('Task is null - cannot reschedule')
    }

    const newTime = startTime + task.intervalMs
    const timeout = newTime - this.dateTimeHelpers.ts()
    this.timers[taskType] = this.timerHelpers.setTimeout(() => this.executeTask(taskType), timeout)
    this.logService.logInfo(this, `Scheduled task ${taskType} for ${newTime} (in ${timeout}ms)`)
  }
}

class TaskExecutor {
  private readonly logContext: LogContext
  private readonly taskType: TaskType
  private readonly task: ITask
  private logs: string[]

  constructor (logContext: LogContext, taskType: TaskType, task: ITask) {
    this.logContext = logContext
    this.taskType = taskType
    this.task = task
    this.logs = []
  }

  public async execute (): Promise<string> {
    const log = await this.task.execute(this.onNewLog)
    if (log != null) {
      this.onNewLog(log)
    }

    return this.getLogs()
  }

  public getLogs (): string {
    return this.logs.join('\n')
  }

  private onNewLog = (newLog: string) => {
    this.logs.push(newLog)
    this.logContext.logInfo(`[${this.taskType}]`, newLog)
  }
}
