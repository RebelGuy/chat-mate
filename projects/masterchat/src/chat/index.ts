import { LogContext } from '@rebel/shared/ILogService'
import { Action, UnknownAction } from "../interfaces/actions";
import { YTAction } from "../interfaces/yt/chat";
import { omitTrackingParams } from "../utils";
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
import { parseRemoveChatItemByAuthorAction } from "./actions/removeChatItemByAuthorAction";

/**
 * Parse raw action object and returns Action
 */
export function parseAction(logContext: LogContext, action: YTAction): Action | UnknownAction {
  const filteredActions = omitTrackingParams(action);
  const type = Object.keys(filteredActions)[0] as keyof typeof filteredActions;

  switch (type) {
    case "addChatItemAction": {
      const parsed = parseAddChatItemAction(logContext, action[type]!);
      if (parsed) return parsed;
      break;
    }

    case "markChatItemsByAuthorAsDeletedAction":
      return parseMarkChatItemsByAuthorAsDeletedAction(action[type]!);

    case "markChatItemAsDeletedAction":
      return parseMarkChatItemAsDeletedAction(logContext, action[type]!);

    case "addLiveChatTickerItemAction": {
      const parsed = parseAddLiveChatTickerItemAction(logContext, action[type]!);
      if (parsed) return parsed;
      break;
    }

    case "replaceChatItemAction":
      return (
        parseReplaceChatItemAction(logContext, action[type]!) ??
        ({
          type: "unknown",
          payload: "parseReplaceChatItemAction returned null",
        } as UnknownAction)
      );

    case "addBannerToLiveChatCommand":
      return (
        parseAddBannerToLiveChatCommand(logContext, action[type]!) ??
        ({
          type: "unknown",
          payload: "addBannerToLiveChatCommand is broken at the moment",
        } as UnknownAction)
      );

    case "removeBannerForLiveChatCommand":
      return parseRemoveBannerForLiveChatCommand(action[type]!);

    case "removeChatItemByAuthorAction":
      return parseRemoveChatItemByAuthorAction(action[type]!);

    case "showLiveChatTooltipCommand":
      return parseShowLiveChatTooltipCommand(action[type]!);

    case "showLiveChatActionPanelAction":
      const parsed = parseShowLiveChatActionPanelAction(logContext, action[type]!);
      return parsed;

    case "updateLiveChatPollAction":
      return parseUpdateLiveChatPollAction(action[type]!);

    case "closeLiveChatActionPanelAction":
      return parseCloseLiveChatActionPanelAction(action[type]!);
    
    case "showLiveChatDialogAction":
      return { type: "unknown", payload: "showLiveChatDialogAction payload" } as UnknownAction

    default: {
      const _: never = type;
      logContext.logError(
        "[action required] Unrecognized action type:",
        JSON.stringify(action)
      );
    }
  }

  return {
    type: "unknown",
    payload: action,
  } as UnknownAction;
}
