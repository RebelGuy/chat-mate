import { Task, TaskLog } from '@prisma/client'
import { PublicTask } from '@rebel/api-models/public/task/PublicTask'
import { PublicTaskLog } from '@rebel/api-models/public/task/PublicTaskLog'

export function taskToPublic (task: Task, lastSuccess: number | null, lastFailure: number | null): PublicTask {
  return {
    taskType: task.taskType,
    intervalMs: task.intervalMs,
    lastSuccess: lastSuccess,
    lastFailure: lastFailure
  }
}

export function taskLogToPublic (taskLog: TaskLog): PublicTaskLog {
  return {
    id: taskLog.id,
    startTime: taskLog.startTime.getTime(),
    endTime: taskLog.endTime?.getTime() ?? null,
    log: taskLog.log ?? '',
    errorMessage: taskLog.errorMessage
  }
}
