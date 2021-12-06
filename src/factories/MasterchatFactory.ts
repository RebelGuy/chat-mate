import { Dependencies } from '@rebel/context/context';
import IFactory from '@rebel/factories/IFactory';
import { IMasterchat } from '@rebel/interfaces';
import MockMasterchat from '@rebel/mocks/MockMasterchat'
import FileService from '@rebel/services/FileService'
import LogService from '@rebel/services/LogService'
import { Masterchat } from 'masterchat';

export default class MasterchatFactory implements IFactory<IMasterchat> {
  readonly name = MasterchatFactory.name
  readonly liveId: string
  readonly channelId: string
  readonly auth: string
  readonly mockData: string | null
  readonly fileService: FileService
  readonly logService: LogService

  constructor (deps: Dependencies) {
    this.liveId = deps.resolve<string>('liveId')
    this.channelId = deps.resolve<string>('channelId')
    this.auth = deps.resolve<string>('auth')
    this.mockData = deps.resolve<string | null>('mockData')
    this.fileService = deps.resolve<FileService>(FileService.name)
    this.logService = deps.resolve<LogService>(LogService.name)
  }

  public create (): IMasterchat {
    if (this.mockData) {
      this.logService.logInfo(this, 'Using MockMasterchat for auto-playing data')
      return new MockMasterchat(this.fileService, this.mockData)
    } else {
      // note: there is a bug where the "live chat" (as opposed to "top chat") option in FetchChatOptions doesn't work,
      // so any messages that might be spammy/inappropriate will not show up.
      return new Masterchat(this.liveId, this.channelId, { mode: 'live', credentials: this.auth })
    }
  }
}
