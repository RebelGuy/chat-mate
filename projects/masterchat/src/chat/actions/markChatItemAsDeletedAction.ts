import { LogContext } from '@rebel/shared/ILogService'
import { MarkChatItemAsDeletedAction } from "../../interfaces/actions";
import { YTMarkChatItemAsDeletedAction } from "../../interfaces/yt/chat";

export function parseMarkChatItemAsDeletedAction(
  logContext: LogContext,
  payload: YTMarkChatItemAsDeletedAction
) {
  const statusText = payload.deletedStateMessage.runs[0].text;
  switch (statusText) {
    case "[message retracted]":
    case "[message deleted]":
      break;
    default:
      logContext.logError(
        "[action required] Unrecognized deletion status:",
        statusText,
        JSON.stringify(payload)
      );
      throw new Error(
        `Unrecognized deletion status: ${JSON.stringify(payload.deletedStateMessage)}`
      );
  }

  const retracted = statusText === "[message retracted]";

  const parsed: MarkChatItemAsDeletedAction = {
    type: "markChatItemAsDeletedAction",
    retracted,
    targetId: payload.targetItemId
  };
  return parsed;
}
