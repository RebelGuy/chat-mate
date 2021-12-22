import { Dependencies } from '@rebel/server/context/context';
import IProvider from '@rebel/server/providers/IProvider';
import { IMasterchat } from '@rebel/server/interfaces';
import MockMasterchat from '@rebel/server/mocks/MockMasterchat'
import FileService from '@rebel/server/services/FileService'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat';
import ChatStore from '@rebel/server/stores/ChatStore'

export default class MasterchatProvider implements IProvider<IMasterchat> {
  readonly name = MasterchatProvider.name

  private readonly liveId: string
  private readonly channelId: string
  private readonly auth: string
  private readonly isMockLivestream: boolean | null
  private readonly fileService: FileService
  private readonly logService: LogService
  private readonly masterChat: IMasterchat
  private readonly chatStore: ChatStore

  constructor (deps: Dependencies) {
    this.liveId = deps.resolve<string>('liveId')
    this.channelId = deps.resolve<string>('channelId')
    this.auth = deps.resolve<string>('auth')
    this.isMockLivestream = deps.resolve<boolean | null>('isMockLivestream')
    this.fileService = deps.resolve<FileService>(FileService.name)
    this.logService = deps.resolve<LogService>(LogService.name)
    this.chatStore = deps.resolve<ChatStore>(ChatStore.name)

    if (this.isMockLivestream) {
      this.logService.logInfo(this, 'Using MockMasterchat for auto-playing data')
      this.masterChat = new MockMasterchat(this.logService, this.chatStore)
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
