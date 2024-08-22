import { Task, TaskType } from '@prisma/client'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { ensureMaxTextWidth } from '@rebel/shared/util/text'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class TaskStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public async getTask (taskType: TaskType): Promise<Task> {
    return await this.db.task.findUniqueOrThrow({ where: { taskType: taskType }})
  }

  public async getTimeSinceLastTaskExecution (taskType: TaskType): Promise<number | null> {
    const result = await this.db.taskLog.findFirst({
      where: { task: { taskType: taskType }},
      orderBy: { startTime: 'desc' }
    })

    return result?.startTime.getTime() ?? null
  }

  public async startTask (taskType: TaskType): Promise<number> {
    const task = await this.db.taskLog.create({ data: {
      startTime: new Date(),
      task: { connect: { taskType: taskType }}
    }})

    return task.id
  }

  public async endTask (taskLogId: number, log: string): Promise<void> {
    await this.db.taskLog.update({
      where: { id: taskLogId },
      data: {
        endTime: new Date(),
        log: ensureMaxTextWidth(log, 4096) // max length comes directly from the db - do not change this.
      }
    })
  }

  public async failTask (taskLogId: number, log: string, errorMessage: string): Promise<void> {
    await this.db.taskLog.update({
      where: { id: taskLogId },
      data: {
        endTime: new Date(),

        // the max lengths come directly from the db - do not change this.
        log: ensureMaxTextWidth(log, 4096),
        errorMessage: ensureMaxTextWidth(errorMessage, 4096)
      }
    })
  }
}
