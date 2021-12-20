import { ChatResponse } from '@rebel/server/../../masterchat/lib/masterchat';

export interface IMasterchat {
  fetch(chatToken?: string): Promise<ChatResponse>
}

export interface ILoggable {
  readonly name: string
}
