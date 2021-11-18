import { Dependencies } from '@rebel/context/ContextProvider';
import { ChatItem } from '@rebel/models/chat';
import FileService from '@rebel/services/FileService';
import { List } from 'immutable';

type ChatSave = {
  continuationToken: string | null
  chat: ChatItem[]
}

export default class ChatStore {
  private readonly liveId: string
  private readonly fileService: FileService
  private readonly fileName: string

  // what happens if the token is very old? can we get ALL messages until now in a single request, or what happens?
  private _continuationToken: string | null
  public get continuationToken () { return this._continuationToken }

  private _chatItems: List<ChatItem>
  public get chatItems () { return this._chatItems }

  constructor (dep: Dependencies) {
    this.liveId = dep.resolve<string>('liveId')
    this.fileService = dep.resolve<FileService>(FileService.name)
    this.fileName = this.fileService.getDataFilePath(`chat_${this.liveId}.json`)

    const content: ChatSave | null = this.fileService.loadObject<ChatSave>(this.fileName)
    this._chatItems = List(content?.chat ?? [])
    this._continuationToken = content?.continuationToken ?? null
  }

  public addChat (token: string, newChat: ChatItem[]) {
    this._continuationToken = token
    console.log(`adding ${newChat.length} new chat items`)

    if (newChat.length > 0) {
      const sorted = List(newChat).sort((c1, c2) => c1.timestamp - c2.timestamp)
      const latestSavedTime = this._chatItems.last()?.timestamp ?? new Date(0)
      if (sorted.first()!.timestamp < latestSavedTime) {
        // this should never happen
        throw new Error('Cannot add chat item(s) because their timestamps are later than one or more saved items')
      }

      this._chatItems = this._chatItems.push(...newChat)
    }

    this.save()
  }

  private save () {
    this.fileService.saveObject<ChatSave>(this.fileName, {
      chat: this._chatItems.toArray(),
      continuationToken: this._continuationToken
    })
  }
}
