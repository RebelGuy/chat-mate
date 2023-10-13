import { MarkChatItemsByAuthorAsDeletedAction } from "../../interfaces/actions";
import { YTMarkChatItemsByAuthorAsDeletedAction } from "../../interfaces/yt/chat";

export function parseMarkChatItemsByAuthorAsDeletedAction(
  payload: YTMarkChatItemsByAuthorAsDeletedAction
): MarkChatItemsByAuthorAsDeletedAction {
  return {
    type: "markChatItemsByAuthorAsDeletedAction",
    channelId: payload.externalChannelId,
    moderatorChannelName: payload.deletedStateMessage.runs[1].text
  };
}
