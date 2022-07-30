import { ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicLogTimestamps } from '@rebel/server/controllers/public/log/PublicLogTimestamps'
import LogQueryService from '@rebel/server/services/LogQueryService'
import { GET, Path } from 'typescript-rest'

export type GetTimestampsResponse = ApiResponse<1, {
  timestamps: Tagged<1, PublicLogTimestamps>
}>

type Deps = ControllerDependencies<{
  logQueryService: LogQueryService
}>

@Path(buildPath('log'))
export default class LogController extends ControllerBase {
  private readonly logQueryService: LogQueryService

  constructor (deps: Deps) {
    super(deps, 'log')
    this.logQueryService = deps.resolve('logQueryService')
  }

  @GET
  @Path('/timestamps')
  public getTimestamps (): GetTimestampsResponse {
    const builder = super.registerResponseBuilder<GetTimestampsResponse>('GET /timestamps', 1)
    try {
      const logs = this.logQueryService.queryCriticalLogs()
      return builder.success({
        timestamps: {
          schema: 1,
          warnings: logs.warnings,
          errors: logs.errors
        }
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
