import { ApiResponse, buildPath, ControllerBase, ControllerDependencies, Tagged } from '@rebel/server/controllers/ControllerBase'
import { requireAuth, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { PublicLivestream } from '@rebel/server/controllers/public/livestream/PublicLivestream'
import { livestreamToPublic } from '@rebel/server/models/livestream'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { GET, Path, PreProcessor } from 'typescript-rest'

type GetLivestreamsResponse = ApiResponse<1, {
  livestreams: Tagged<1, PublicLivestream>[]
}>

type Deps = ControllerDependencies<{
  livestreamStore: LivestreamStore
}>

@Path(buildPath('livestream'))
@PreProcessor(requireStreamer)
export default class LivestreamController extends ControllerBase {
  private readonly livestreamStore: LivestreamStore

  constructor (deps: Deps) {
    super(deps, 'livestream')
    this.livestreamStore = deps.resolve('livestreamStore')
  }

  @GET
  @Path('/')
  public async getLivestreams (): Promise<GetLivestreamsResponse> {
    const builder = this.registerResponseBuilder<GetLivestreamsResponse>('GET /', 1)
    try {
      const livestreams = await this.livestreamStore.getLivestreams(this.getStreamerId()!)
      return builder.success({
        livestreams: livestreams.map(livestreamToPublic)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
