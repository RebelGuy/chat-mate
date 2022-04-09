import { ChatResponse, Metadata } from '@rebel/masterchat'

export interface IMasterchat {
  fetch (chatToken?: string): Promise<ChatResponse>
  fetchMetadata (): Promise<Metadata>
  /** Returns true if the request succeeded. */
  banYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean>
  /** Returns true if the request succeeded. */
  unbanYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean>
}

export type TwitchMetadata = {
  streamId: string
  startTime: Date
  title: string
  viewerCount: number
}

export interface ITwurpleApi {
  // returns null if the stream hasn't started
  fetchMetadata (): Promise<TwitchMetadata | null>
}

export interface ILoggable {
  readonly name: string
}
