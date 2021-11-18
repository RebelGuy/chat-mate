import { Dependencies } from '@rebel/context/ContextProvider';
import IFactory from '@rebel/factories/IFactory';
import { Masterchat } from 'masterchat';

export default class MasterchatFactory implements IFactory<Masterchat> {
  readonly liveId: string
  readonly channelId: string
  readonly auth: string

  constructor (deps: Dependencies) {
    this.liveId = deps.resolve<string>('liveId')
    this.channelId = deps.resolve<string>('channelId')
    this.auth = deps.resolve<string>('auth')
  }

  public create () {
    return new Masterchat(this.liveId, this.channelId, { mode: 'live', credentials: this.auth })
  }
}
