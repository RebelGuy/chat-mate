import { ChatResponse, Metadata } from '@rebel/masterchat'

export interface IMasterchat {
  fetch (chatToken?: string): Promise<ChatResponse>
  fetchMetadata (): Promise<Metadata>
}

export type TwitchMetadata = {
  streamId: string
  startTime: Date
  title: string
  viewerCount: number
}

export interface ITwurpleApi {
  fetchMetadata (): Promise<TwitchMetadata>
}

export interface ILoggable {
  readonly name: string
}
