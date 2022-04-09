import { Action, UnknownAction } from "../interfaces/actions";
import { YTAction } from "../interfaces/yt/chat";
import { debugLog, omitTrackingParams } from "../utils";
import { parseAddBannerToLiveChatCommand } from "./actions/addBannerToLiveChatCommand";
import { parseAddChatItemAction } from "./actions/addChatItemAction";
import { parseAddLiveChatTickerItemAction } from "./actions/addLiveChatTickerItemAction";
import { parseCloseLiveChatActionPanelAction } from "./actions/closeLiveChatActionPanelAction";
import { parseMarkChatItemAsDeletedAction } from "./actions/markChatItemAsDeletedAction";
import { parseMarkChatItemsByAuthorAsDeletedAction } from "./actions/markChatItemsByAuthorAsDeletedAction";
import { parseRemoveBannerForLiveChatCommand } from "./actions/removeBannerForLiveChatCommand";
import { parseReplaceChatItemAction } from "./actions/replaceChatItemAction";
import { parseShowLiveChatActionPanelAction } from "./actions/showLiveChatActionPanelAction";
import { parseShowLiveChatTooltipCommand } from "./actions/showLiveChatTooltipCommand";
import { parseUpdateLiveChatPollAction } from "./actions/updateLiveChatPollAction";

/**
 * Parse raw action object and returns Action
 */
export function parseAction(action: YTAction): Action | UnknownAction {
  const filteredActions = omitTrackingParams(action);
  const type = Object.keys(filteredActions)[0] as keyof typeof filteredActions;

  switch (type) {
    case "addChatItemAction": {
      const parsed = parseAddChatItemAction(action[type]!);
      if (parsed) return parsed;
      break;
    }

    case "markChatItemsByAuthorAsDeletedAction":
      return parseMarkChatItemsByAuthorAsDeletedAction(action[type]!);

    case "markChatItemAsDeletedAction":
      return parseMarkChatItemAsDeletedAction(action[type]!);

    case "addLiveChatTickerItemAction": {
      const parsed = parseAddLiveChatTickerItemAction(action[type]!);
      if (parsed) return parsed;
      break;
    }

    case "replaceChatItemAction":
      return (
        parseReplaceChatItemAction(action[type]!) ??
        ({
          type: "unknown",
          payload: "parseReplaceChatItemAction returned null",
        } as UnknownAction)
      );

    case "addBannerToLiveChatCommand":
      return (
        parseAddBannerToLiveChatCommand(action[type]!) ??
        ({
          type: "unknown",
          payload: "addBannerToLiveChatCommand is broken at the moment",
        } as UnknownAction)
      );

    case "removeBannerForLiveChatCommand":
      return parseRemoveBannerForLiveChatCommand(action[type]!);

    case "showLiveChatTooltipCommand":
      return parseShowLiveChatTooltipCommand(action[type]!);

    case "showLiveChatActionPanelAction":
      const parsed = parseShowLiveChatActionPanelAction(action[type]!);
      return parsed;

    case "updateLiveChatPollAction":
      return parseUpdateLiveChatPollAction(action[type]!);

    case "closeLiveChatActionPanelAction":
      return parseCloseLiveChatActionPanelAction(action[type]!);

    default: {
      const _: never = type;
      debugLog(
        "[action required] Unrecognized action type:",
        JSON.stringify(action)
      );
    }
  }

  // non-type payloads that are not currently categorised are info messages
  // e.g. the "<user> was hidden by <mod>" grey message.
  // in the future, we will need to listen to these as they mark events
  // that are relevant for us. (CHAT-293)
  // could parse them based on an expected template (similar to the quoted example above)

  return {
    type: "unknown",
    payload: action,
  } as UnknownAction;
}
