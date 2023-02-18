import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider from '@rebel/server/providers/DbProvider'
import { AccessToken } from '@twurple/auth'

type Deps = Dependencies<{
  twitchClientId: string
  dbProvider: DbProvider
}>

export default class AuthStore extends ContextClass {
  private readonly twitchClientId: string
  private readonly dbProvider: DbProvider

  constructor (deps: Deps) {
    super()

    this.twitchClientId = deps.resolve('twitchClientId')
    this.dbProvider = deps.resolve('dbProvider')
  }

  /** Loads the Twitch access token for the current client id. Throws if the token doesn't exist. To set the token, use the `TwitchAuth.js` script. */
  public async loadTwitchAccessToken (): Promise<AccessToken> {
    const auth = await this.dbProvider.get().twitchAuth.findUnique({
      where: {
        clientId: this.twitchClientId
      },
      rejectOnNotFound: true
    })

    return {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresIn: auth.expiresIn,
      obtainmentTimestamp: Number(auth.obtainmentTimestamp),
      scope: auth.scope.split(',')
    }
  }

  public async loadYoutubeAccessToken (channelId: string): Promise<string | null> {
    const result = await this.dbProvider.get().youtubeAuth.findUnique({ where: { channelId }})
    return result?.accessToken ?? null
  }

  public async saveTwitchAccessToken (token: AccessToken) {
    const tokenData = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken!,
      expiresIn: token.expiresIn!,
      obtainmentTimestamp: token.obtainmentTimestamp,
      scope: token.scope.join(',')
    }

    return await this.dbProvider.get().twitchAuth.upsert({
      create: { clientId: this.twitchClientId, ...tokenData },
      where: { clientId: this.twitchClientId },
      update: { ...tokenData }
    })
  }

  public async saveYoutubeAccessToken (channelId: string, accessToken: string) {
    const updateTime = new Date()
    await this.dbProvider.get().youtubeAuth.upsert({
      create: { channelId, accessToken, updateTime },
      where: { channelId },
      update: { accessToken, updateTime }
    })
  }
}
