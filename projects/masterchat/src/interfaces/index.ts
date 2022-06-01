import { LiveStatus } from '@rebel/masterchat'
import { Action } from "./actions";
import { TimedContinuation } from "./misc";
export * from "./actions";
export * from "./context";
export * from "./contextActions";
export * from "./misc";
export * from "./yt";

export interface Metadata {
  videoId: string;
  channelId: string;
  channelName?: string;
  title?: string;
  /** @deprecated **Do not use this for checking if the stream is currently live of not, as it is bugged.**
   * Use `liveStatus` instead. */
  isLive?: boolean;
  liveStatus: LiveStatus
  /** Undefined if we don't know. */
  viewerCount?: number
}

export interface ChatResponse {
  actions: Action[];
  continuation: TimedContinuation | undefined;
  error: null;
}

export interface Credentials {
  SAPISID: string;
  APISID: string;
  HSID: string;
  SID: string;
  SSID: string;

  /**
   * @deprecated Use DELEGATED_SESSION_ID
   */
  SESSION_ID?: string;

  /**
   * Delegated session id for brand account
   */
  DELEGATED_SESSION_ID?: string;
}
