import { LogContext } from '@rebel/shared/ILogService'
import { AddBannerAction } from "../../interfaces/actions";
import { YTAddBannerToLiveChatCommand } from "../../interfaces/yt/chat";
import { stringify, tsToDate } from "../../utils";
import { parseBadges } from "../badge";
import { pickThumbUrl } from "../utils";

export function parseAddBannerToLiveChatCommand(
  logContext: LogContext,
  payload: YTAddBannerToLiveChatCommand
) {
  // add pinned item
  const bannerRdr = payload["bannerRenderer"]["liveChatBannerRenderer"];

  if (bannerRdr.header.liveChatBannerHeaderRenderer.icon.iconType !== "KEEP") {
    logContext.logError(
      "[action required] unknown icon type (addBannerToLiveChatCommand)",
      JSON.stringify(bannerRdr.header.liveChatBannerHeaderRenderer.icon)
    );
  }

  if (bannerRdr.contents.liveChatTextMessageRenderer == null) {
    return null
  }
  
  // banner
  const actionId = bannerRdr.actionId;
  const targetId = bannerRdr.targetId;
  const viewerIsCreator = bannerRdr.viewerIsCreator;

  // header
  const header = bannerRdr.header.liveChatBannerHeaderRenderer;
  const title = header.text.runs;

  // contents
  const liveChatRdr = bannerRdr.contents.liveChatTextMessageRenderer;
  const id = liveChatRdr.id;
  const message = liveChatRdr.message.runs;
  const timestampUsec = liveChatRdr.timestampUsec;
  const timestamp = tsToDate(timestampUsec);
  const authorName = stringify(liveChatRdr.authorName);
  const authorPhoto = pickThumbUrl(liveChatRdr.authorPhoto);
  const authorChannelId = liveChatRdr.authorExternalChannelId;
  const { isVerified, isOwner, isModerator, membership } =
    parseBadges(logContext, liveChatRdr);

  if (!authorName) {
    logContext.logError(
      "[action required] empty authorName at addBannerToLiveChatCommand",
      JSON.stringify(liveChatRdr)
    );
  }

  const parsed: AddBannerAction = {
    type: "addBannerAction",
    actionId,
    targetId,
    id,
    title,
    message,
    timestampUsec,
    timestamp,
    authorName,
    authorPhoto,
    authorChannelId,
    isVerified,
    isOwner,
    isModerator,
    membership,
    viewerIsCreator,
    contextMenuEndpointParams:
      liveChatRdr.contextMenuEndpoint?.liveChatItemContextMenuEndpoint.params,
  };
  return parsed;
}
