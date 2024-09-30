import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AuthService from '@rebel/server/services/AuthService'
import ChannelService from '@rebel/server/services/ChannelService'
import LinkService from '@rebel/server/services/LinkService'

type Deps = Dependencies<{
  authService: AuthService
  channelService: ChannelService
  linkService: LinkService
}>

export default class UserLinkService extends ContextClass {
  private readonly authService: AuthService
  private readonly channelService: ChannelService
  private readonly linkService: LinkService

  constructor (deps: Deps) {
    super()
    this.authService = deps.resolve('authService')
    this.channelService = deps.resolve('channelService')
    this.linkService = deps.resolve('linkService')
  }

  public async linkYoutubeAccountToUser (code: string, aggregateUserId: number): Promise<void> {
    const channelInfo = await this.authService.authoriseYoutubeUserAndGetChannel(code)
    const channel = await this.channelService.getOrCreateYoutubeChannel(channelInfo.id, channelInfo.name, channelInfo.image, false)
    await this.linkService.linkUser(channel.userId, aggregateUserId, null)
  }

  public async linkTwitchAccountToUser (code: string, aggregateUserId: number): Promise<void> {
    const channelInfo = await this.authService.authoriseTwitchUserAndGetChannel(code)
    const channel = await this.channelService.getOrCreateTwitchChannel(channelInfo.id, channelInfo.name, channelInfo.displayName, '', '')
    await this.linkService.linkUser(channel.userId, aggregateUserId, null)
  }
}
