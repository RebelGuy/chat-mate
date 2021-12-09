import { Dependencies } from '@rebel/context/context';
import IProvider from '@rebel/providers/IProvider';
import { IMasterchat } from '@rebel/interfaces';
import MockMasterchat from '@rebel/mocks/MockMasterchat'
import FileService from '@rebel/services/FileService'
import LogService from '@rebel/services/LogService'
import { Masterchat } from 'masterchat';

export default class MasterchatProvider implements IProvider<IMasterchat> {
  readonly name = MasterchatProvider.name

  private readonly liveId: string
  private readonly channelId: string
  private readonly auth: string
  private readonly mockData: string | null
  private readonly fileService: FileService
  private readonly logService: LogService
  private readonly masterChat: IMasterchat

  constructor (deps: Dependencies) {
    this.liveId = deps.resolve<string>('liveId')
    this.channelId = deps.resolve<string>('channelId')
    this.auth = deps.resolve<string>('auth')
    this.mockData = deps.resolve<string | null>('mockData')
    this.fileService = deps.resolve<FileService>(FileService.name)
    this.logService = deps.resolve<LogService>(LogService.name)

    if (this.mockData) {
      this.logService.logInfo(this, 'Using MockMasterchat for auto-playing data')
      this.masterChat = new MockMasterchat(this.fileService, this.logService, this.mockData)
    } else {
      // note: there is a bug where the "live chat" (as opposed to "top chat") option in FetchChatOptions doesn't work,
      // so any messages that might be spammy/inappropriate will not show up.
      this.masterChat = new Masterchat(this.liveId, this.channelId, { mode: 'live', credentials: this.auth })
    }
  }

  public get (): IMasterchat {
    return this.masterChat
  }
}
