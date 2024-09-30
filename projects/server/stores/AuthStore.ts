import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider from '@rebel/server/providers/DbProvider'
import { AccessToken } from '@twurple/auth'
import { YoutubeAuth, YoutubeWebAuth } from '@prisma/client'
import { New } from '@rebel/server/models/entities'
import { ChatMateError } from '@rebel/shared/util/error'

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
    const auth = await this.dbProvider.get().twitchAuth.findUniqueOrThrow({
      where: { twitchUserId: twitchUserId }
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
    const auth = await this.dbProvider.get().twitchAuth.findFirstOrThrow({
      where: { twitchUsername: twitchChannelName }
    })

    return {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresIn: auth.expiresIn,
      obtainmentTimestamp: Number(auth.obtainmentTimestamp),
      scope: auth.scope.split(',')
    }
  }

  public async loadYoutubeAccessToken (externalYoutubeChannelId: string): Promise<YoutubeAuth | null> {
    return await this.dbProvider.get().youtubeAuth.findUnique({
      where: { externalYoutubeChannelId }
    })
  }

  /** Returns all Youtube external channel ids for channels that have authorised ChatMate. */
  public async getExternalChannelIdsWithYoutubeAuth (): Promise<string[]> {
    const result = await this.dbProvider.get().youtubeAuth.findMany({
      select: { externalYoutubeChannelId: true }
    })

    return result.map(r => r.externalYoutubeChannelId)
  }

  public async loadYoutubeWebAccessToken (channelId: string): Promise<YoutubeWebAuth | null> {
    return await this.dbProvider.get().youtubeWebAuth.findUnique({ where: { channelId }})
  }

  /** Must provide a Twitch username when creating a new access token, but it's not required when refreshing the token. */
  public async saveTwitchAccessToken (twitchUserId: string, twitchUsername: string | null, token: AccessToken) {
    const tokenData = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken!,
      expiresIn: token.expiresIn!,
      obtainmentTimestamp: token.obtainmentTimestamp,
      scope: token.scope.join(',')
    }

    const existingToken = await this.dbProvider.get().twitchAuth.findFirst({
      where: twitchUsername != null ? { twitchUsername } : { twitchUserId }
    })
    if (existingToken == null) {
      if (twitchUsername == null) {
        throw new ChatMateError('Must provide a Twitch username when creating a new access token')
      }

      await this.dbProvider.get().twitchAuth.create({ data: { twitchUsername, twitchUserId, ...tokenData }})
    } else {
      await this.dbProvider.get().twitchAuth.update({
        where: { id: existingToken.id },
        data: {
          ...tokenData,
          twitchUsername: twitchUsername ?? undefined,
          twitchUserId: twitchUserId
        }
      })
    }
  }

  public async saveYoutubeAccessToken (youtubeAuth: New<YoutubeAuth>): Promise<void> {
    const existingToken = await this.dbProvider.get().youtubeAuth.findUnique({
      where: { externalYoutubeChannelId: youtubeAuth.externalYoutubeChannelId }
    })

    // for some reason, we can't use upsert here but I don't understand why (weird runtime error)
    if (existingToken == null) {
      await this.dbProvider.get().youtubeAuth.create({ data: youtubeAuth })
    } else {
      await this.dbProvider.get().youtubeAuth.update({
        where: { externalYoutubeChannelId: youtubeAuth.externalYoutubeChannelId },
        data: youtubeAuth
      })
    }
  }

  public async saveYoutubeWebAccessToken (channelId: string, accessToken: string) {
    const updateTime = new Date()
    await this.dbProvider.get().youtubeWebAuth.upsert({
      create: { channelId, accessToken, updateTime },
      where: { channelId },
      update: { accessToken, updateTime }
    })
  }

  public async tryDeleteTwitchAccessToken (twitchUserId: string) {
    // deleteMany supresses the not-found error
    await this.dbProvider.get().twitchAuth.deleteMany({ where: { twitchUserId }})
  }

  public async tryDeleteYoutubeAccessToken (externalYoutubeChannelId: string) {
    // deleteMany supresses the not-found error
    await this.dbProvider.get().youtubeAuth.deleteMany({ where: { externalYoutubeChannelId }})
  }
}
