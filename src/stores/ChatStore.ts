import { Dependencies } from '@rebel/context/context';
import { ChatItem } from '@rebel/models/chat';
import FileService from '@rebel/services/FileService';
import { List } from 'immutable';

export type ChatSave = {
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

  // appends the new chat to the stored chat. throws if the new chat overlaps in time with the existing chat.
  public addChat (token: string, newChat: ChatItem[]) {
    this._continuationToken = token
    console.log(`adding ${newChat.length} new chat items`)

    if (newChat.length > 0) {
      const sorted = List(newChat).sort((c1, c2) => c1.timestamp - c2.timestamp)
      const latestSavedTime = this._chatItems.last()?.timestamp ?? 0
      const validNewChat = newChat.filter(c => c.timestamp > latestSavedTime)
      if (newChat.length !== validNewChat.length) {
        // this should never happen, but we should still handle it gracefully
        // todo: add logging to file
        console.warn(`[ChatStore] Cannot add ${newChat.length - validNewChat.length} chat item(s) because their timestamps are earlier than the last saved item - discarding those items`)
      }

      this._chatItems = this._chatItems.push(...validNewChat)
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
