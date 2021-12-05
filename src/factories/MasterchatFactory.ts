import { Dependencies } from '@rebel/context/context';
import IFactory from '@rebel/factories/IFactory';
import { IMasterchat } from '@rebel/interfaces';
import MockMasterchat from '@rebel/mocks/MockMasterchat'
import FileService from '@rebel/services/FileService'
import { Masterchat } from 'masterchat';

export default class MasterchatFactory implements IFactory<IMasterchat> {
  readonly liveId: string
  readonly channelId: string
  readonly auth: string
  readonly mockData: string | null
  readonly fileService: FileService

  constructor (deps: Dependencies) {
    this.liveId = deps.resolve<string>('liveId')
    this.channelId = deps.resolve<string>('channelId')
    this.auth = deps.resolve<string>('auth')
    this.mockData = deps.resolve<string | null>('mockData')
    this.fileService = deps.resolve<FileService>(FileService.name)
  }

  public create (): IMasterchat {
    if (this.mockData) {
      console.log('Using MockMasterchat for auto-playing data')
      return new MockMasterchat(this.fileService, this.mockData)
    } else {
      return new Masterchat(this.liveId, this.channelId, { mode: 'live', credentials: this.auth })
    }
  }
}
