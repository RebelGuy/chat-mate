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
  /** Returns null if the stream hasn't started. */
  fetchMetadata (): Promise<TwitchMetadata | null>
  ban (twitchUserName: string, reason: string): Promise<void>
  /** The channel is the owner's channel, NOT the channel of the user that is to be timed out. */
  timeout (channel: string, twitchUserName: string, durationSeconds: number, reason: string): Promise<void>
}

export interface ILoggable {
  readonly name: string
}
