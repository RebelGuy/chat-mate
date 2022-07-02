import { LogsQueryClient, LogsQueryResultStatus, LogsTable, QueryTimeInterval } from '@azure/monitor-query'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogsQueryClientProvider from '@rebel/server/providers/LogsQueryClientProvider'
import { addTime } from '@rebel/server/util/datetime'

type Deps = Dependencies<{
  logAnalyticsWorkspaceId: string
  logsQueryClientProvider: LogsQueryClientProvider
}>

export default class LogQueryService extends ContextClass {
  private readonly client: LogsQueryClient
  private readonly logAnalyticsWorkspaceId: string

  constructor (deps: Deps) {
    super()

    this.client = deps.resolve('logsQueryClientProvider').get()
    this.logAnalyticsWorkspaceId = deps.resolve('logAnalyticsWorkspaceId')
  }

  public async queryCriticalLogs (sinceTimestamp: number): Promise<LogsTable[]> {
    const duration: QueryTimeInterval = {
      startTime: new Date(sinceTimestamp + 1),
      endTime: addTime(new Date(), 'seconds', 5)
    } 
    const options = {
      includeVisualization: true
    }

    const result = await this.client.queryWorkspace(
      this.logAnalyticsWorkspaceId,
      getTracesQueryBuilder([2, 3], 100),
      duration,
      options
    )

    if (result.status === LogsQueryResultStatus.Success) {
      return result.tables
    } else {
      throw new Error(`Something went wrong while querying logs. Code ${result.partialError.code} (${result.partialError.name}: ${result.partialError.message})`)
    }
  }
}

// queries can be run either
// - in the application insights Transaction Search section (uses `trace` for the table name)
// - in the log analytics workspace Logs sections
function getTracesQueryBuilder (severity: number[], limit: number) {
  return `union isfuzzy=true AppTraces, AppExceptions, AppRequests
  | where severityLevel in (${severity.map(s => `"${s}"`).join(', ')})
  | order by timestamp desc
  | take ${limit}
  | render columnchart`
}
