import {
  MembersOnlyError,
  NoPermissionError,
  NoStreamRecordingError,
  UnavailableError,
} from "../errors";
import { runsToString } from "../utils";
import { VideoPrimaryInfoRenderer, YTInitialData, YTPlayabilityStatus } from "../interfaces/yt/context";
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { YTRunContainer, YTSimpleTextContainer, YTText, YTTextRun } from '@rebel/masterchat/interfaces/yt/chat'

// OK duration=">0" => Archived (replay chat may be available)
// OK duration="0" => Live (chat may be available)
// LIVE_STREAM_OFFLINE => Offline (chat may be available)
function assertPlayability(playabilityStatus: YTPlayabilityStatus | undefined) {
  if (!playabilityStatus) {
    throw new Error("playabilityStatus missing");
  }
  switch (playabilityStatus.status) {
    case "ERROR":
      throw new UnavailableError(playabilityStatus.reason!);
    case "LOGIN_REQUIRED":
      throw new NoPermissionError(playabilityStatus.reason!);
    case "UNPLAYABLE": {
      if (
        "playerLegacyDesktopYpcOfferRenderer" in playabilityStatus.errorScreen!
      ) {
        throw new MembersOnlyError(playabilityStatus.reason!);
      }
      throw new NoStreamRecordingError(playabilityStatus.reason!);
    }
    case "LIVE_STREAM_OFFLINE":
    case "OK":
  }
}

export function findCfg(data: string) {
  const match = /ytcfg\.set\(({.+?})\);/.exec(data);
  if (!match) return;
  return JSON.parse(match[1]);
}

export function findIPR(data: string): unknown {
  const match = /var ytInitialPlayerResponse = (.+?);var meta/.exec(data);
  if (!match) return;
  return JSON.parse(match[1]);
}

export function findInitialData(data: string): YTInitialData | undefined {
  const match =
    /(?:var ytInitialData|window\["ytInitialData"\]) = (.+?);<\/script>/.exec(
      data
    );
  if (!match) return;
  return JSON.parse(match[1]);
}

export function findEPR(data: string) {
  return findCfg(data)?.PLAYER_VARS?.embedded_player_response;
}

export function findPlayabilityStatus(
  data: string
): YTPlayabilityStatus | undefined {
  const ipr = findIPR(data);
  return (ipr as any)?.playabilityStatus;
}
// embed disabled https://www.youtube.com/embed/JfJYHfrOGgQ
// unavailable video https://www.youtube.com/embed/YEAINgb2xfo
// private video https://www.youtube.com/embed/UUjdYGda4N4
// 200 OK

export async function parseMetadataFromEmbed (html: string) {
  const epr = findEPR(html);

  const ps = epr.previewPlayabilityStatus;
  assertPlayability(ps);

  const ep = epr.embedPreview;

  const prevRdr = ep.thumbnailPreviewRenderer;
  const vdRdr = prevRdr.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer;
  const expRdr =
    vdRdr.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer;

  const title = runsToString(prevRdr.title.runs);
  const thumbnail =
    prevRdr.defaultThumbnail.thumbnails[
      prevRdr.defaultThumbnail.thumbnails.length - 1
    ].url;
  const channelId = expRdr.subscribeButton.subscribeButtonRenderer.channelId;
  const channelName = runsToString(expRdr.title.runs);
  const channelThumbnail = vdRdr.channelThumbnail.thumbnails[0].url;
  const duration = Number(prevRdr.videoDurationSeconds);

  return {
    title,
    thumbnail,
    channelId,
    channelName,
    channelThumbnail,
    duration,
    status: ps.status,
    statusText: ps.reason,
  };
}

export function parseMetadataFromWatch (html: string): Omit<Metadata, 'videoId'> {
  const initialData = findInitialData(html)!;

  const playabilityStatus = findPlayabilityStatus(html);
  assertPlayability(playabilityStatus);

  // TODO: initialData.contents.twoColumnWatchNextResults.conversationBar.conversationBarRenderer.availabilityMessage.messageRenderer.text.runs[0].text === 'Chat is disabled for this live stream.'
  const results =
    initialData.contents?.twoColumnWatchNextResults?.results.results!;

  const primaryInfo = results.contents[0].videoPrimaryInfoRenderer;
  const videoOwner =
    results.contents[1].videoSecondaryInfoRenderer.owner.videoOwnerRenderer;

  const title = runsToString(primaryInfo.title.runs);
  const channelId = videoOwner.navigationEndpoint.browseEndpoint.browseId;
  const channelName = runsToString(videoOwner.title.runs);
  const isLive = primaryInfo.viewCount!.videoViewCountRenderer.isLive ?? false;

  const viewCount = parseViewCount(primaryInfo)

  const dateText = primaryInfo.dateText.simpleText.toLowerCase().trim()
  let liveStatus: LiveStatus
  // 'Live stream currently offline'
  // 'Scheduled for <date>'
  // 'Started streaming <time> ago'
  // 'Streamed <time> ago'
  if (dateText.endsWith('offline') || dateText.startsWith('scheduled')) {
    liveStatus = 'not_started'
  } else if (dateText.startsWith('started streaming')) {
    liveStatus = 'live'
  } else if (dateText.startsWith('streamed')) {
    liveStatus = 'finished'
  } else {
    liveStatus = 'unknown'
  }

  return {
    title,
    channelId,
    channelName,
    isLive,
    liveStatus,

    // undefined view count can be interpreted as zero viewers if we are live
    viewerCount: viewCount ?? (liveStatus === 'live' ? 0 : undefined)
  };
}

function parseViewCount (primaryInfo: VideoPrimaryInfoRenderer): number | undefined {
  // when viewers are watching, there is a "n watching now" message under the livestream.
  // for some reason, this can be broken up into multiple runs
  const viewCountContainer = primaryInfo.viewCount?.videoViewCountRenderer.viewCount as YTText | {};

  let viewCountText: string | null = null
  if (isYtSimpleTextContainer(viewCountContainer)) {
    viewCountText = viewCountContainer.simpleText.split(' ')[0]
  } else if (isYtRunContainer(viewCountContainer)) {
    const runs = viewCountContainer.runs
    if (runs.length > 0 && isYtTextRun(runs[0])) {
      viewCountText = runs[0].text.split(' ')[0]
    }
  }

  if (viewCountText == null) {
    return undefined
  } else {
    const parsed = Number(viewCountText.replace(',', ''))
    return parsed == null || isNaN(parsed) ? undefined : parsed
  }
}

function isYtSimpleTextContainer (obj: unknown): obj is YTSimpleTextContainer {
  return Object.getOwnPropertyNames(obj).includes('simpleText')
}

function isYtRunContainer (obj: unknown): obj is YTRunContainer {
  return Object.getOwnPropertyNames(obj).includes('runs')
}

function isYtTextRun (obj: unknown): obj is YTTextRun {
  return Object.getOwnPropertyNames(obj).includes('text')
}
