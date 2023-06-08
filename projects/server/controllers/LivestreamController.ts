import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireStreamer } from '@rebel/server/controllers/preProcessors'
import { livestreamToPublic } from '@rebel/server/models/livestream'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { GET, Path, PreProcessor } from 'typescript-rest'
import { GetLivestreamsResponse } from '@rebel/api-models/schema/livestream'

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
    const builder = this.registerResponseBuilder<GetLivestreamsResponse>('GET /')
    try {
      const livestreams = await this.livestreamStore.getLivestreams(this.getStreamerId())
      return builder.success({
        livestreams: livestreams.map(livestreamToPublic)
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
