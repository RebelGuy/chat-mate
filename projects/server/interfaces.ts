import { ChatResponse, Metadata } from '@rebel/masterchat'

export interface IMasterchat {
  fetch (chatToken?: string): Promise<ChatResponse>
  fetchMetadata (): Promise<Metadata>
}

export interface ILoggable {
  readonly name: string
}
