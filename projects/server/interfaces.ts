import { ChatResponse, Metadata } from '@rebel/masterchat'

export interface IMasterchat {
  fetch (chatToken?: string): Promise<ChatResponse>
  fetchMetadata (): Promise<Metadata>
  /** Returns true if the request succeeded. */
  banYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean>
  /** Returns true if the request succeeded. */
  unbanYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean>
}
