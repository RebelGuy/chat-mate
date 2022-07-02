import { ApiRequest, ApiResponse, buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import LogQueryService from '@rebel/server/services/LogQueryService'
import { GET, Path, QueryParam } from 'typescript-rest'

export type GetCriticalLogsRequest = ApiRequest<1, { schema: 1 }>

export type GetCriticalLogsResponse = ApiResponse<1, any>

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
  @Path('/critical')
  public async getCriticalLogs (
    @QueryParam('since') since: number
  ): Promise<GetCriticalLogsResponse> {
    const builder = super.registerResponseBuilder<GetCriticalLogsResponse>('GET /critical', 1)
    if (since == null) {
      return builder.failure(400, '`since` query parameter is missing')
    }

    try {
      const logs = await this.logQueryService.queryCriticalLogs(since)
      return builder.success(logs)
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
