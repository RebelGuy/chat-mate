import { LogContext } from '@rebel/shared/ILogService'
import { ReplaceChatItemAction } from "../../interfaces/actions";
import { YTReplaceChatItemAction } from "../../interfaces/yt/chat";
import {
  parseLiveChatPaidMessageRenderer,
  parseLiveChatPlaceholderItemRenderer,
  parseLiveChatTextMessageRenderer,
} from "./addChatItemAction";

export function parseReplaceChatItemAction(logContext: LogContext, payload: YTReplaceChatItemAction) {
  const parsedItem = parseReplacementItem(logContext, payload.replacementItem);
  if (parsedItem == null) {
    return null
  }

  const parsed: ReplaceChatItemAction = {
    type: "replaceChatItemAction",
    targetItemId: payload.targetItemId,
    replacementItem: parsedItem,
  };
  return parsed;
}

function parseReplacementItem(
  logContext: LogContext,
  item: YTReplaceChatItemAction["replacementItem"]
) {
  if ("liveChatPlaceholderItemRenderer" in item) {
    return parseLiveChatPlaceholderItemRenderer(
      item.liveChatPlaceholderItemRenderer
    );
  } else if ("liveChatTextMessageRenderer" in item) {
    return parseLiveChatTextMessageRenderer(logContext, item.liveChatTextMessageRenderer!);
  } else if ("liveChatPaidMessageRenderer" in item) {
    // TODO: check if YTLiveChatPaidMessageRendererContainer will actually appear
    logContext.logError(
      "[action required] observed liveChatPaidMessageRenderer as a replacementItem"
    );
    return parseLiveChatPaidMessageRenderer(logContext, item.liveChatPaidMessageRenderer);
  } else {
    logContext.logError(
      "[action required] unrecognized replacementItem type:",
      JSON.stringify(item)
    );
    return null;
  }
}
