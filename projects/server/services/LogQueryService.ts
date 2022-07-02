import { LogsQueryClient, LogsQueryResultStatus, LogsTable, QueryTimeInterval } from '@azure/monitor-query'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import LogsQueryClientProvider from '@rebel/server/providers/LogsQueryClientProvider'
import { addTime } from '@rebel/server/util/datetime'

type Deps = Dependencies<{
  logAnalyticsWorkspaceId: string
  logsQueryClientProvider: LogsQueryClientProvider
  dateTimeHelpers: DateTimeHelpers
}>

// sorted in ascending order
export type LogTimestamps = {
  warnings: number[]
  errors: number[]
}

export default class LogQueryService extends ContextClass {
  private readonly client: LogsQueryClient
  private readonly logAnalyticsWorkspaceId: string
  private readonly dateTimeHelpers: DateTimeHelpers

  // in-memory log counter until we can query directly from azure
  private errors: number[] = []
  private warnings: number[] = []

  constructor (deps: Deps) {
    super()

    this.client = deps.resolve('logsQueryClientProvider').get()
    this.logAnalyticsWorkspaceId = deps.resolve('logAnalyticsWorkspaceId')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
  }

  public onWarning () {
    this.warnings.push(this.dateTimeHelpers.ts())
  }

  public onError () {
    this.errors.push(this.dateTimeHelpers.ts())
  }

  /** Returns the timestamps of warnings and errors from the last 24 hours. */
  public queryCriticalLogs (): LogTimestamps {
    this.removeOldTimestamps()

    return {
      warnings: [...this.warnings],
      errors: [...this.errors]
    }
  }

  // CHAT-334 not used until the query authentication is fixed 
  public async queryCriticalLogs_ (sinceTimestamp: number): Promise<LogsTable[]> {
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

  private removeOldTimestamps () {
    const lastDay = addTime(this.dateTimeHelpers.now(), 'days', -1).getTime()
    this.errors = this.errors.filter(ts => ts >= lastDay)
    this.warnings = this.warnings.filter(ts => ts >= lastDay)
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
