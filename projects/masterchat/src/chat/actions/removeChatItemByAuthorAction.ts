import { RemoveChatItemByAuthorAction } from "../../interfaces/actions";
import { YTRemoveChatItemByAuthorAction } from "../../interfaces/yt/chat";

// stolen from https://github.com/stu43005/masterchat/commit/e56b79b61f4a34b1c420626139c24be32b59070a
export function parseRemoveChatItemByAuthorAction(
  payload: YTRemoveChatItemByAuthorAction
) {
  const parsed: RemoveChatItemByAuthorAction = {
    type: "removeChatItemByAuthorAction",
    channelId: payload.externalChannelId
  };
  return parsed;
}
