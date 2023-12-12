import { buildPath, ControllerBase, ControllerDependencies } from '@rebel/server/controllers/ControllerBase'
import { requireStreamer } from '@rebel/server/controllers/preProcessors'
import { twitchLivestreamToPublic, youtubeLivestreamToPublic } from '@rebel/server/models/livestream'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { GET, Path, PreProcessor } from 'typescript-rest'
import { GetLivestreamsResponse } from '@rebel/api-models/schema/livestream'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'

type Deps = ControllerDependencies<{
  livestreamStore: LivestreamStore
  streamerChannelService: StreamerChannelService
}>

@Path(buildPath('livestream'))
@PreProcessor(requireStreamer)
export default class LivestreamController extends ControllerBase {
  private readonly livestreamStore: LivestreamStore
  private readonly streamerChannelService: StreamerChannelService

  constructor (deps: Deps) {
    super(deps, 'livestream')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.streamerChannelService = deps.resolve('streamerChannelService')
  }

  @GET
  @Path('/')
  public async getLivestreams (): Promise<GetLivestreamsResponse> {
    const builder = this.registerResponseBuilder<GetLivestreamsResponse>('GET /')
    try {
      const streamerId = this.getStreamerId()
      const youtubeLivestreams = await this.livestreamStore.getYoutubeLivestreams(streamerId)
      const twitchLivestreams = await this.livestreamStore.getTwitchLivestreams(streamerId)
      const externalChannelId = await this.streamerChannelService.getYoutubeExternalId(streamerId)

      return builder.success({
        youtubeLivestreams: youtubeLivestreams.map(youtubeLivestreamToPublic),
        twitchLivestreams: twitchLivestreams.map(i => twitchLivestreamToPublic(i, externalChannelId ?? ''))
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
