import { ApiRequest, ApiResponse } from '@rebel/api-models/types'
import { PublicTask } from '@rebel/api-models/public/task/PublicTask'
import { PublicTaskLog } from '@rebel/api-models/public/task/PublicTaskLog'
import { EmptyObject } from '@rebel/shared/types'

export type GetTasksResponse = ApiResponse<{ tasks: PublicTask[] }>

export type GetTaskLogsResponse = ApiResponse<{ taskLogs: PublicTaskLog[] }>

export type UpdateTaskRequest = ApiRequest<{ taskType: string, intervalMs: number }>

export type UpdateTaskResponse = ApiResponse<EmptyObject>

export type ExecuteTaskResponse = ApiResponse<EmptyObject>
