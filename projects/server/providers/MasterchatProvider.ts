import { Dependencies } from '@rebel/server/context/context';
import IProvider from '@rebel/server/providers/IProvider';
import { IMasterchat } from '@rebel/server/interfaces';
import MockMasterchat from '@rebel/server/mocks/MockMasterchat'
import FileService from '@rebel/server/services/FileService'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat';
import ChatStore from '@rebel/server/stores/ChatStore'

type Deps = Dependencies<{
  liveId: string,
  channelId: string,
  auth: string,
  isMockLivestream: boolean | null,
  fileService: FileService,
  logService: LogService,
  chatStore: ChatStore 
}>

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

  constructor (deps: Deps) {
    this.liveId = deps.resolve('liveId')
    this.channelId = deps.resolve('channelId')
    this.auth = deps.resolve('auth')
    this.isMockLivestream = deps.resolve('isMockLivestream')
    this.fileService = deps.resolve('fileService')
    this.logService = deps.resolve('logService')
    this.chatStore = deps.resolve('chatStore')

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
