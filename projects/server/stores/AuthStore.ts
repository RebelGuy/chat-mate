import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider from '@rebel/server/providers/DbProvider'
import { AccessToken } from '@twurple/auth'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class AuthStore extends ContextClass {
  private readonly dbProvider: DbProvider

  constructor (deps: Deps) {
    super()

    this.dbProvider = deps.resolve('dbProvider')
  }

  /** Loads the Twitch access token for the given user. Throws if the token doesn't exist (the user must authorise ChatMate via Studio). */
  public async loadTwitchAccessToken (twitchUserId: string): Promise<AccessToken> {
    const auth = await this.dbProvider.get().twitchAuth.findUnique({
      where: { twitchUserId: twitchUserId },
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

  /** Loads the Twitch access token for the Twitch channel. Throws if the access token doesn't exist. */
  public async loadTwitchAccessTokenByChannelName (twitchChannelName: string): Promise<AccessToken> {
    const auth = await this.dbProvider.get().twitchAuth.findFirst({
      where: { twitchUsername: twitchChannelName },
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

  /** Must provide a Twitch username when creating a new access token (not required when refreshing the token).
   * The userId is also required when creating/refreshing, except for the ChatMate admin Twitch channel token. */
  public async saveTwitchAccessToken (twitchUserId: string | null, twitchUsername: string | null, token: AccessToken) {
    const tokenData = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken!,
      expiresIn: token.expiresIn!,
      obtainmentTimestamp: token.obtainmentTimestamp,
      scope: token.scope.join(',')
    }

    if (twitchUserId == null && twitchUsername == null) {
      throw new Error('Must provide a Twitch user ID or username when saving an access token')
    }

    const existingToken = await this.dbProvider.get().twitchAuth.findFirst({
      where: twitchUsername != null ? { twitchUsername } : { twitchUserId }
    })
    if (existingToken == null) {
      if (twitchUsername == null) {
        throw new Error('Must provide a Twitch username when creating a new access token')
      }

      await this.dbProvider.get().twitchAuth.create({ data: { twitchUsername, twitchUserId, ...tokenData }})
    } else {
      await this.dbProvider.get().twitchAuth.update({
        where: { id: existingToken.id },
        data: {
          ...tokenData,

          // only updated non-null user data
          twitchUsername: twitchUsername ?? undefined,
          twitchUserId: twitchUserId ?? undefined
        }
      })
    }
  }

  public async saveYoutubeAccessToken (channelId: string, accessToken: string) {
    const updateTime = new Date()
    await this.dbProvider.get().youtubeAuth.upsert({
      create: { channelId, accessToken, updateTime },
      where: { channelId },
      update: { accessToken, updateTime }
    })
  }

  public async tryDeleteTwitchAccessToken (twitchUserId: string) {
    // deleteMany supresses the not-found error
    await this.dbProvider.get().twitchAuth.deleteMany({where: { twitchUserId }})
  }
}
