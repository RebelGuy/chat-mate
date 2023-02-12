import { LogContext } from '@rebel/shared/ILogService'
import { ShowPanelAction, ShowPollPanelAction } from "../../interfaces/actions";
import {
  YTLiveChatPollRenderer,
  YTShowLiveChatActionPanelAction,
} from "../../interfaces/yt/chat";
import { pickThumbUrl } from "../utils";

export function parseShowLiveChatActionPanelAction(
  logContext: LogContext,
  payload: YTShowLiveChatActionPanelAction
) {
  const panelRdr = payload.panelToShow.liveChatActionPanelRenderer;
  const rendererType = Object.keys(panelRdr.contents)[0];
  switch (rendererType) {
    case "pollRenderer": {
      const rdr = panelRdr.contents.pollRenderer as YTLiveChatPollRenderer;
      const authorName =
        rdr.header.pollHeaderRenderer.metadataText.runs[0].text;

      const parsed: ShowPollPanelAction = {
        type: "showPollPanelAction",
        targetId: panelRdr.targetId,
        id: panelRdr.id,
        choices: rdr.choices,
        question: rdr.header.pollHeaderRenderer.pollQuestion?.simpleText,
        authorName,
        authorPhoto: pickThumbUrl(rdr.header.pollHeaderRenderer.thumbnail),
        pollType: rdr.header.pollHeaderRenderer.liveChatPollType,
      };

      return parsed;
    }
    default: {
      logContext.logError(
        "[action required] unrecognized rendererType (parseShowLiveChatActionPanelAction):",
        JSON.stringify(payload)
      );
    }
  }

  const parsed: ShowPanelAction = {
    type: "showPanelAction",
    panelToShow: payload.panelToShow,
  };
  return parsed;
}
