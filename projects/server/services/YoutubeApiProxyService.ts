import { youtube_v3 } from '@googleapis/youtube'
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

    // fucking dogshit client typings built diff
    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/insert#parameters
    const result = await api.liveChatModerators.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          moderatorDetails: {
            channelId: userExternalChannelId
          },
          liveChatId: liveId
        }
      }
    })

    if (result.status !== 200) {
      // error
    }

    return result.data.id!
  }

  public async unmod (ownerExternalChannelId: string, externalModId: string): Promise<void> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/delete
    const result = await api.liveChatModerators.delete({
      id: externalModId
    })

    if (result.status !== 204) {
      // error
    }
  }

  public async getMods (ownerExternalChannelId: string, liveId: string): Promise<{ externalModId: string, externalChannelId: string }[]> {
    const api = await this.wrappedApi(ownerExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/list
    const result = await api.liveChatModerators.list({
      part: ['id', 'snippet'],
      liveChatId: liveId,
      maxResults: 50
    })

    if (result.status !== 200) {
      // error
    }

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

  public async ban (modExternalChannelId: string, userExternalChannelId: string, liveId: string): Promise<string> {
    const api = await this.wrappedApi(modExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatBans/insert
    const result = await api.liveChatBans.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId: liveId,
          type: 'permanent',
          bannedUserDetails: {
            channelId: userExternalChannelId
          }
        }
      }
    })

    if (result.status !== 200) {
      // error
    }

    return result.data.id!
  }

  public async timeout (modExternalChannelId: string, userExternalChannelId: string, liveId: string, durationSeconds: number): Promise<string> {
    const api = await this.wrappedApi(modExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatBans/insert
    const result = await api.liveChatBans.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId: liveId,
          type: 'temporary',
          bannedUserDetails: {
            channelId: userExternalChannelId
          },
          banDurationSeconds: `${durationSeconds}`
        }
      }
    })

    if (result.status !== 200) {
      // error
    }

    return result.data.id!
  }

  public async unbanOrUntimeout (modExternalChannelId: string, externalPunishmentId: string): Promise<void> {
    const api = await this.wrappedApi(modExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatBans/insert
    const result = await api.liveChatBans.delete({
      id: externalPunishmentId
    })

    if (result.status !== 204) {
      // error
    }
  }

  private createApiWrapper (): (requestOwnerExternalChannelId: string) => Promise<youtube_v3.Youtube> {
    return async (requestOwnerExternalChannelId: string) => {
      const client = await this.youtubeApiClientProvider.getClientForStreamer(requestOwnerExternalChannelId)

      return {
        liveChatModerators: {
          list: super.wrapRequest((params: youtube_v3.Params$Resource$Livechatmoderators$List) => client.liveChatModerators.list(params), 'youtube_v3.liveChatModerators.list'),
          insert: super.wrapRequest((params: youtube_v3.Params$Resource$Livechatmoderators$Insert) => client.liveChatModerators.insert(params), 'youtube_v3.liveChatModerators.insert'),
          delete: super.wrapRequest((params: youtube_v3.Params$Resource$Livechatmoderators$Delete) => client.liveChatModerators.delete(params), 'youtube_v3.liveChatModerators.delete')
        },
        liveChatBans: {
          insert: super.wrapRequest((params: youtube_v3.Params$Resource$Livechatbans$Insert) => client.liveChatBans.insert(params), 'youtube_v3.liveChatBans.insert'),
          delete: super.wrapRequest((params: youtube_v3.Params$Resource$Livechatbans$Delete) => client.liveChatBans.delete(params), 'youtube_v3.liveChatBans.delete')
        }
      } as youtube_v3.Youtube
    }
  }
}
