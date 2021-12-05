import { ChatResponse } from '@rebel/../../masterchat/lib/masterchat';

export interface IMasterchat {
  fetch(chatToken?: string): Promise<ChatResponse>
}