import { youtube_v3 } from '@googleapis/youtube'
import { YoutubeApiClientProvider } from '@rebel/server/providers/YoutubeApiClientProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import ApiService from '@rebel/server/services/abstract/ApiService'
import AuthStore from '@rebel/server/stores/AuthStore'
import PlatformApiStore, { ApiPlatform } from '@rebel/server/stores/PlatformApiStore'
import { Dependencies } from '@rebel/shared/context/context'
import { ChatMateError } from '@rebel/shared/util/error'
import { GaxiosError } from 'gaxios'

// note: the youtube api is absolutely disgusting. this took a lot of trial and error to figure out
// - why do we need to provide a liveId for punishments/moderators, when these actions apply to the channel globally anyway?
// - why do we need to unmod/unpunish using youtube's convoluted internal id, instead of just specifying the channelId?
// - why is their api so horribly slow?
// - why is their api so horribly limited? (can't list banned channels?!)
// - why is their api quota so unreasonable? (we would love to use it to fetch messages, but at the recommended fetch rate (2 per second) we would burn through our daily quota within 2-3 hours, for a single channel)
// - why are their error messages inconsistent? (304 if we try to ban a channel that is already banned - wtf)
// - why, if a timeout is just a temporary type of ban, can we remove permanent bans using the api, but not timeouts?
// - why?

type Endpoint =
  'youtube_v3.liveChatModerators.list' |
  'youtube_v3.liveChatModerators.insert' |
  'youtube_v3.liveChatModerators.delete' |
  'youtube_v3.liveChatBans.insert' |
  'youtube_v3.liveChatBans.delete' |
  'youtube_v3.videos.list' |
  'youtube_v3.liveBroadcasts.list'

// the nice devs over at youtube didn't think it was necessary to document these, so i took it upon myself to find these
// via the API quota dashboard: console.cloud.google.com -> APIs and services -> YouTube Data API v3 -> Quotas.
// some are listed here though: https://developers.google.com/youtube/v3/determine_quota_cost
// we track API requests via the PlatformApiStore for internal auditing purposes since the youtube API quota is _extremely_ low (10000 units per day).
// if we ever run into issues with the limit and can't increase it, we will need to fallback to making requests via masterchat, though that is a problem for a later time
const ENDPOINT_COSTS: Record<Endpoint, number> = {
  'youtube_v3.liveChatModerators.list': 50,
  'youtube_v3.liveChatModerators.insert': 200,
  'youtube_v3.liveChatModerators.delete': 200,
  'youtube_v3.liveChatBans.insert': 200,
  'youtube_v3.liveChatBans.delete': 200,
  'youtube_v3.videos.list': 1,
  'youtube_v3.liveBroadcasts.list': 1
}

type Deps = Dependencies<{
  logService: LogService
  youtubeStatusService: StatusService
  youtubeApiClientProvider: YoutubeApiClientProvider
  platformApiStore: PlatformApiStore
  authStore: AuthStore
  streamerChannelService: StreamerChannelService
}>

export default class YoutubeApiProxyService extends ApiService {
  private readonly youtubeApiClientProvider: YoutubeApiClientProvider
  private readonly authStore: AuthStore
  private readonly streamerChannelService: StreamerChannelService

  private readonly wrappedApi: (streamerId: number, requestOwnerExternalChannelId: string) => Promise<youtube_v3.Youtube>

  constructor (deps: Deps) {
    const name = YoutubeApiProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('youtubeStatusService')
    const platformApiStore = deps.resolve('platformApiStore')
    const apiPlatform: ApiPlatform = 'youtubeApi'
    const timeout = null
    super(name, logService, statusService, platformApiStore, apiPlatform, timeout, false)

    this.youtubeApiClientProvider = deps.resolve('youtubeApiClientProvider')
    this.authStore = deps.resolve('authStore')
    this.streamerChannelService = deps.resolve('streamerChannelService')

    this.wrappedApi = this.createApiWrapper()
  }

  public async getBroadcastId (streamerId: number, ownerExternalChannelId: string): Promise<string | null> {
    const api = await this.wrappedApi(streamerId, ownerExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/list
    const result = await api.liveBroadcasts.list({
      part: ['id', 'snippet', 'status'], // we could use `snippet` to sort by time in case there are multiple active streams
      broadcastStatus: 'active' // if we set this to `all`, it will also include the persistent stream (thought it is not marked as such so we cannot distinguish it from scheduled streams)
    })

    return result.data.items!.find(broadcast => broadcast.status?.lifeCycleStatus !== 'complete')?.id ?? null
  }

  public async mod (streamerId: number, ownerExternalChannelId: string, userExternalChannelId: string, liveId: string): Promise<string> {
    const api = await this.wrappedApi(streamerId, ownerExternalChannelId)

    const liveChatId = this.getLiveChatId(ownerExternalChannelId, liveId)

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

  public async unmod (streamerId: number, ownerExternalChannelId: string, externalModId: string): Promise<void> {
    const api = await this.wrappedApi(streamerId, ownerExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatModerators/delete
    await api.liveChatModerators.delete({
      id: externalModId
    })
  }

  public async getMods (streamerId: number, ownerExternalChannelId: string, liveId: string): Promise<{ externalModId: string, externalChannelId: string }[]> {
    const api = await this.wrappedApi(streamerId, ownerExternalChannelId)

    const liveChatId = this.getLiveChatId(ownerExternalChannelId, liveId)

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

  public async ban (streamerId: number, ownerExternalChannelId: string, userExternalChannelId: string, liveId: string): Promise<string> {
    const api = await this.wrappedApi(streamerId, ownerExternalChannelId)

    const liveChatId = this.getLiveChatId(ownerExternalChannelId, liveId)

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

  public async timeout (streamerId: number, ownerExternalChannelId: string, userExternalChannelId: string, liveId: string, durationSeconds: number): Promise<string> {
    const api = await this.wrappedApi(streamerId, ownerExternalChannelId)

    const liveChatId = this.getLiveChatId(ownerExternalChannelId, liveId)

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

  public async unban (streamerId: number, ownerExternalChannelId: string, externalPunishmentId: string): Promise<void> {
    // weirdly, we cannot use the same endpoint to remove timeouts - we have to instead create a new one with a duration of 0 seconds

    const api = await this.wrappedApi(streamerId, ownerExternalChannelId)

    // https://developers.google.com/youtube/v3/live/docs/liveChatBans/insert
    await api.liveChatBans.delete({
      id: externalPunishmentId
    })
  }

  // confusingly we can't use the video id (`liveId`) when making requests to the API, we have to first fetch the associated `liveChatId` :(
  private getLiveChatId (externalChannelId: string, liveId: string): string {
    // const api = await this.wrappedApi(externalChannelId)

    // https://developers.google.com/youtube/v3/docs/videos/list
    // example: https://github.com/DustinWatts/YouTubeLiveChat/blob/master/livechat.js
    // const livestreamVideo = await api.videos.list({
    //   part: ['liveStreamingDetails'],
    //   id: [liveId]
    // })

    // const liveChatId = (livestreamVideo.data.items ?? [])[0]?.liveStreamingDetails?.activeLiveChatId

    // similar to constructing the LiveBanId in the YoutubeService. note that `liveId` must be an active livestream, otherwise, even though we
    // can construct the `liveChatId`, any request using this id will fail with the message "The live chat user you are trying to ban cannot be found."
    let liveChatId = Buffer.from(`\n\r\n\x0b${liveId}*'\n\x18${externalChannelId}\x12\x0b${liveId}`, 'utf-8')
      .toString('base64')
      .replace(/=+$/, '') // remove trailing '='

    if (liveChatId == null) {
      throw new ChatMateError(`Could not retrieve liveChatId for liveId ${liveId}. Does it exist and is it active?`)
    } else {
      return liveChatId
    }
  }

  private createApiWrapper (): (streamerId: number, requestOwnerExternalChannelId: string) => Promise<youtube_v3.Youtube> {
    return async (streamerId: number, requestOwnerExternalChannelId: string) => {
      const client = await this.youtubeApiClientProvider.getClientForStreamer(requestOwnerExternalChannelId)

      return {
        liveChatModerators: {
          list: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatmoderators$List) => client.liveChatModerators.list(params), streamerId, 'youtube_v3.liveChatModerators.list'),
          insert: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatmoderators$Insert) => client.liveChatModerators.insert(params), streamerId, 'youtube_v3.liveChatModerators.insert'),
          delete: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatmoderators$Delete) => client.liveChatModerators.delete(params), streamerId, 'youtube_v3.liveChatModerators.delete')
        },
        liveChatBans: {
          insert: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatbans$Insert) => client.liveChatBans.insert(params), streamerId, 'youtube_v3.liveChatBans.insert'),
          delete: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livechatbans$Delete) => client.liveChatBans.delete(params), streamerId, 'youtube_v3.liveChatBans.delete')
        },
        videos: {
          list: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Videos$List) => client.videos.list(params), streamerId, 'youtube_v3.videos.list')
        },
        liveBroadcasts: {
          list: this.wrapRequestWithErrorLogging((params: youtube_v3.Params$Resource$Livebroadcasts$List) => client.liveBroadcasts.list(params), streamerId, 'youtube_v3.liveBroadcasts.list')
        }
      } as youtube_v3.Youtube
    }
  }

  // this is a wrapper around a wrapper because javascript serialisation of error objects is fucked,
  // and we need to intercept GaxiosErrors unless we want to log error info that is essentially empty
  private wrapRequestWithErrorLogging<TParams, TResult> (request: (params: TParams) => Promise<TResult>, streamerId: number, endpoint: Endpoint): (params: TParams) => Promise<TResult> {
    return super.wrapRequest(async (params: TParams) => {
      try {
        return await request(params)

      } catch (e: any) {
        if (e instanceof GaxiosError) {
          this.logService.logError(this, `Request ${endpoint} received an error response (code ${e.status}):`, e.response?.data)

          if (e.message === 'invalid_grant') {
            this.logService.logInfo(this, `Invalidating access token for streamer ${streamerId}...`)
            const externalChannelId = await this.streamerChannelService.getYoutubeExternalId(streamerId)
            if (externalChannelId == null) {
              this.logService.logError(this, `Unable to invalidate access token for streamer ${streamerId} because no primary youtube channel exists`)
            } else {
              await this.authStore.tryDeleteYoutubeAccessToken(externalChannelId)
            }
          }
        }

        throw e
      }
    }, endpoint, streamerId)
  }
}
