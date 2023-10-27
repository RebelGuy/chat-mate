import { youtube_v3 } from '@googleapis/youtube'
import { YoutubeApiClientProvider } from '@rebel/server/providers/YoutubeApiClientProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import ApiService from '@rebel/server/services/abstract/ApiService'
import { Dependencies } from '@rebel/shared/context/context'
import { GaxiosError } from 'gaxios'

type Deps = Dependencies<{
  logService: LogService
  youtubeStatusService: StatusService
  youtubeApiClientProvider: YoutubeApiClientProvider
}>

export default class YoutubeApiProxyService extends ApiService {
  private readonly youtubeApiClientProvider: YoutubeApiClientProvider
  private readonly wrappedApi: (requestOwnerExternalChannelId: string) => Promise<youtube_v3.Youtube>

  constructor (deps: Deps) {
    const name = YoutubeApiProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('youtubeStatusService')
    const timeout = null
    super(name, logService, statusService, timeout, false)
    this.youtubeApiClientProvider = deps.resolve('youtubeApiClientProvider')

    this.wrappedApi = this.createApiWrapper()
  }

  public async mod (ownerExternalChannelId: string, userExternalChannelId: string, liveId: string): Promise<string> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    const liveChatId = await this.getLiveChatId(ownerExternalChannelId, liveId)

    // fucking dogshit client typings built diff
    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/insert#parameters
    const result = await api.liveChatModerators.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          moderatorDetails: {
            channelId: userExternalChannelId
          },
          liveChatId: liveChatId
        }
      }
    })

    return result.data.id!
  }

  public async unmod (ownerExternalChannelId: string, externalModId: string): Promise<void> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/delete
    await api.liveChatModerators.delete({
      id: externalModId
    })
  }

  public async getMods (ownerExternalChannelId: string, liveId: string): Promise<{ externalModId: string, externalChannelId: string }[]> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    const liveChatId = await this.getLiveChatId(ownerExternalChannelId, liveId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/list
    const result = await api.liveChatModerators.list({
      part: ['id', 'snippet'],
      liveChatId: liveChatId,
      maxResults: 50
    })

    const data = result.data.items!
    if (data.length >= 40) {
      this.logService.logWarning(this, `Please implement pagination for the liveChatModerators/list endpoint as we are approaching the limit of 50 (${data.length}).`)
    }

    return data.map(mod => ({
      externalModId: mod.id!,
      // why is everything optional, you fuck
      externalChannelId: mod.snippet!.moderatorDetails!.channelId!
    }))
  }

  public async ban (ownerExternalChannelId: string, userExternalChannelId: string, liveId: string): Promise<string> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    const liveChatId = await this.getLiveChatId(ownerExternalChannelId, liveId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatBans/insert
    const result = await api.liveChatBans.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId: liveChatId,
          type: 'permanent',
          bannedUserDetails: {
            channelId: userExternalChannelId
          }
        }
      }
    })

    return result.data.id!
  }

  public async timeout (ownerExternalChannelId: string, userExternalChannelId: string, liveId: string, durationSeconds: number): Promise<string> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    const liveChatId = await this.getLiveChatId(ownerExternalChannelId, liveId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatBans/insert
    const result = await api.liveChatBans.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId: liveChatId,
          type: 'temporary',
          bannedUserDetails: {
            channelId: userExternalChannelId
          },
          banDurationSeconds: `${durationSeconds}`
        }
      }
    })

    return result.data.id!
  }

  public async unbanOrUntimeout (ownerExternalChannelId: string, externalPunishmentId: string): Promise<void> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatBans/insert
    await api.liveChatBans.delete({
      id: externalPunishmentId
    })
  }

  // confusingly we can't use the video id (`liveId`) when making requests to the API, we have to first fetch the associated `liveChatId` :(
  private async getLiveChatId (externalChannelId: string, liveId: string): Promise<string> {
    const api = await this.wrappedApi(externalChannelId)

    // https://developers.google.com/youtube/v3/docs/videos/list
    // example: https://github.com/DustinWatts/YouTubeLiveChat/blob/master/livechat.js
    // todo: we could save this value in the future to save on API requests
    const livestreamVideo = await api.videos.list({
      part: ['liveStreamingDetails'],
      id: [liveId]
    })

    const liveChatId = (livestreamVideo.data.items ?? [])[0].liveStreamingDetails?.activeLiveChatId
    if (liveChatId == null) {
      throw new Error(`Could not retrieve liveChatId for liveId ${liveId}. Does it exist?`)
    } else {
      return liveChatId
    }
  }

  private createApiWrapper (): (requestOwnerExternalChannelId: string) => Promise<youtube_v3.Youtube> {
    return async (requestOwnerExternalChannelId: string) => {
      const client = await this.youtubeApiClientProvider.getClientForStreamer(requestOwnerExternalChannelId)

      return {
        liveChatModerators: {
          list: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatmoderators$List) => client.liveChatModerators.list(params), 'youtube_v3.liveChatModerators.list'),
          insert: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatmoderators$Insert) => client.liveChatModerators.insert(params), 'youtube_v3.liveChatModerators.insert'),
          delete: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatmoderators$Delete) => client.liveChatModerators.delete(params), 'youtube_v3.liveChatModerators.delete')
        },
        liveChatBans: {
          insert: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatbans$Insert) => client.liveChatBans.insert(params), 'youtube_v3.liveChatBans.insert'),
          delete: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatbans$Delete) => client.liveChatBans.delete(params), 'youtube_v3.liveChatBans.delete')
        },
        videos: {
          list: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Videos$List) => client.videos.list(params), 'youtube_v3.videos.list')
        }
      } as youtube_v3.Youtube
    }
  }

  // this is a wrapper around a wrapper because javascript serialisation of error objects is fucked,
  // and we need to intercept GaxiosErrors unless we want to log error info that is essentially empty
  private wrapRequestWithErrorLogging<TParams, TResult> (request: (params: TParams) => Promise<TResult>, requestName: string): (params: TParams) => Promise<TResult> {
    return super.wrapRequest(async (params: TParams) => {
      try {
        return await request(params)
      } catch (e) {
        if (e instanceof GaxiosError) {
          this.logService.logError(this, `Request ${requestName} received an error response:`, e.response?.data)
        }

        throw e
      }
    }, requestName)
  }
}
