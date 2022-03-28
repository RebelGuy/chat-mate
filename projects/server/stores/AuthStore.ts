import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider from '@rebel/server/providers/DbProvider'
import { AccessToken } from '@twurple/auth/lib'

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

  /** Loads the Twitch access token for the current client id, if it exists. */
  public async loadAccessToken (): Promise<AccessToken | null> {
    const auth = await this.dbProvider.get().twitchAuth.findUnique({ where: { clientId: this.twitchClientId }})

    if (auth == null) {
      return null
    } else {
      return {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        expiresIn: auth.expiresIn,
        obtainmentTimestamp: Number(auth.obtainmentTimestamp),
        scope: auth.scope.split(',')
      }
    }
  }

  public async saveAccessToken (token: AccessToken) {
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
}