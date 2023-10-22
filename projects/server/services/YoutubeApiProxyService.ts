import { YoutubeApiClientProvider } from '@rebel/server/providers/YoutubeApiClientProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import ApiService from '@rebel/server/services/abstract/ApiService'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  logService: LogService
  youtubeStatusService: StatusService
  youtubeApiClientProvider: YoutubeApiClientProvider
}>

export default class YoutubeApiProxyService extends ApiService {
  private readonly youtubeApiClientProvider: YoutubeApiClientProvider

  constructor (deps: Deps) {
    const name = YoutubeApiProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('youtubeStatusService')
    const timeout = null
    super(name, logService, statusService, timeout, false)
    this.youtubeApiClientProvider = deps.resolve('youtubeApiClientProvider')
  }

  public async mod (modExternalChannelId: string, userExternalChannelId: string) {
    const client = await this.youtubeApiClientProvider.getClientForStreamer(modExternalChannelId)

    // todo: wrap api, similar to twurple/masterchat
    // fucking dogshit client typings built diff
    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/insert#parameters
    const result = await client.liveChatModerators.insert({
      requestBody: {
        snippet: {
          moderatorDetails: {
            channelId: userExternalChannelId
          }
        }
      }
    })

  }
}