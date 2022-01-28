import { Dependencies } from '@rebel/server/context/context';
import IProvider from '@rebel/server/providers/IProvider';
import { IMasterchat } from '@rebel/server/interfaces';
import MockMasterchat from '@rebel/server/mocks/MockMasterchat'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat';

type Deps = Dependencies<{
  liveId: string,
  channelId: string,
  auth: string,
  isMockLivestream: boolean | null,
  logService: LogService,
}>

export default class MasterchatProvider implements IProvider<IMasterchat> {
  readonly name = MasterchatProvider.name

  private readonly liveId: string
  private readonly channelId: string
  private readonly auth: string
  private readonly isMockLivestream: boolean | null
  private readonly logService: LogService

  private readonly masterchat: IMasterchat

  constructor (deps: Deps) {
    this.liveId = deps.resolve('liveId')
    this.channelId = deps.resolve('channelId')
    this.auth = deps.resolve('auth')
    this.isMockLivestream = deps.resolve('isMockLivestream')
    this.logService = deps.resolve('logService')

    if (this.isMockLivestream) {
      this.logService.logInfo(this, 'Using MockMasterchat for auto-playing data')
      this.masterchat = new MockMasterchat(this.logService)
    } else {
      // note: there is a bug where the "live chat" (as opposed to "top chat") option in FetchChatOptions doesn't work,
      // so any messages that might be spammy/inappropriate will not show up.
      this.masterchat = new Masterchat(this.liveId, this.channelId, { mode: 'live', credentials: this.auth })
    }
  }

  public get (): IMasterchat {
    return this.masterchat
  }
}
