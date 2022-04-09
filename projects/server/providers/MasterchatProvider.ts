import { Dependencies } from '@rebel/server/context/context'
import IProvider from '@rebel/server/providers/IProvider'
import { Masterchat } from '@rebel/masterchat'
import ContextClass from '@rebel/server/context/ContextClass'

type Deps = Dependencies<{
  liveId: string,
  channelId: string,
  auth: string
}>

export default class MasterchatProvider extends ContextClass implements IProvider<Masterchat> {
  readonly name = MasterchatProvider.name

  private readonly liveId: string
  private readonly channelId: string
  private readonly auth: string

  private readonly masterchat: Masterchat

  constructor (deps: Deps) {
    super()
    this.liveId = deps.resolve('liveId')
    this.channelId = deps.resolve('channelId')
    this.auth = deps.resolve('auth')

    // note: there is a bug where the "live chat" (as opposed to "top chat") option in FetchChatOptions doesn't work,
    // so any messages that might be spammy/inappropriate will not show up.
    this.masterchat = new Masterchat(this.liveId, this.channelId, { mode: 'live', credentials: this.auth })
  }

  public get (): Masterchat {
    return this.masterchat
  }
}
