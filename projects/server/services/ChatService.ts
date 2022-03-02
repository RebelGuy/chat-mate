
import { Dependencies } from '@rebel/server/context/context'
import ChatStore from '@rebel/server/stores/ChatStore'
import { Action, AddChatItemAction, YTRun, YTTextRun } from '@rebel/masterchat'
import { ChatItem, getEmojiLabel, getUniqueEmojiId, PartialChatMessage } from '@rebel/server/models/chat'
import { isList, List } from 'immutable'
import { clamp, clampNormFn, sum } from '@rebel/server/util/math'
import { IMasterchat } from '@rebel/server/interfaces'
import LogService, { createLogContext, LogContext } from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ExperienceService from '@rebel/server/services/ExperienceService'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import ContextClass from '@rebel/server/context/ContextClass'
import ChannelStore, { CreateOrUpdateChannelArgs } from '@rebel/server/stores/ChannelStore'
import { zip } from '@rebel/server/util/arrays'

const MIN_INTERVAL = 500
const MAX_INTERVAL = 6_000

// this can approximately be interpreted as the number of chat messages per minute
const MIN_CHAT_RATE = 0.5 / 60
const MAX_CHAT_RATE = 10 / 60

// how far back we will look to determine the dynamic refresh rates
const LIMIT = 120_000

type ChatEvents = {
  newChatItem: {
    item: ChatItem
  }
}

type Deps = Dependencies<{
  chatStore: ChatStore,
  livestreamStore: LivestreamStore,
  logService: LogService,
  masterchatProxyService: MasterchatProxyService,
  experienceService: ExperienceService,
  viewershipStore: ViewershipStore,
  timerHelpers: TimerHelpers,
  channelStore: ChannelStore
}>

export default class ChatService extends ContextClass {
  readonly name = ChatService.name
  private readonly chatStore: ChatStore
  private readonly livestreamStore: LivestreamStore
  private readonly logService: LogService
  private readonly masterchat: IMasterchat
  private readonly experienceService: ExperienceService
  private readonly viewershipStore: ViewershipStore
  private readonly timerHelpers: TimerHelpers
  private readonly channelStore: ChannelStore

  private initialised: boolean = false

  constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchat = deps.resolve('masterchatProxyService')
    this.logService = deps.resolve('logService')
    this.experienceService = deps.resolve('experienceService')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.channelStore = deps.resolve('channelStore')
  }

  // await this method when initialising the service to guarantee an initial fetch
  public override async initialise (): Promise<void> {
    if (this.initialised) {
      throw new Error('Cannot start ChatService because it has already been started')
    }
    this.initialised = true

    const timerOptions: TimerOptions = {
      behaviour: 'dynamicEnd',
      callback: this.updateMessages
    }
    await this.timerHelpers.createRepeatingTimer(timerOptions, true)
  }

  /** Returns true if the chat item was successfully added. */
  public async onNewChatItem (item: ChatItem): Promise<boolean> {
    let addedChat: boolean = false
    try {
      const channelInfo: CreateOrUpdateChannelArgs = {
        name: item.author.name ?? '',
        time: new Date(item.timestamp),
        imageUrl: item.author.image,
        isOwner: item.author.attributes.isOwner,
        isModerator: item.author.attributes.isModerator,
        IsVerified: item.author.attributes.isVerified
      }
      const channel = await this.channelStore.createOrUpdate(item.author.channelId, channelInfo)  

      // todo:
      // item.messageParts = item.messageParts.flatMap(part => this.emojiService.applyCustomEmojis(part, channel.id))

      // there is a known issue where, since we are adding the chat in a separate transaction than the experience, it
      // is possible that calling the GET /chat endpoint returns the level information that does not yet incorporate the
      // experience gained due to the latest chat - see CHAT-166. we could add a flag that indicates that a chat item's side
      // effects have not yet been completed, but honestly that adds a lot of complexity for a small, temporary, unimportant
      // visual inconsitency. so for now just acknowledge this and leave it.
      await this.chatStore.addChat(item, channel.id)
      addedChat = true
    } catch (e: any) {
      this.logService.logError(this, 'Failed to add chat.', e)
    }

    if (addedChat) {
      try {
        const channelId = await this.channelStore.getId(item.author.channelId)
        await this.viewershipStore.addViewershipForChatParticipation(channelId, item.timestamp)
        await this.experienceService.addExperienceForChat(item)
      } catch (e: any) {
        this.logService.logError(this, `Successfully added chat item ${item.id} but failed to complete side effects.`, e)
      }
    }

    return addedChat
  }

  private fetchLatest = async () => {
    const token = this.livestreamStore.currentLivestream.continuationToken
    try {
      const result = token ? await this.masterchat.fetch(token) : await this.masterchat.fetch()
      return result
    } catch (e: any) {
      this.logService.logWarning(this, 'Encountered error while fetching chat:', e.message)
      await this.livestreamStore.setContinuationToken(null)
      return null
    }
  }

  private updateMessages = async () => {
    const response = await this.fetchLatest()

    let hasNewChat: boolean = false
    if (response != null) {
      let chatItems = response.actions
        .filter(action => isAddChatAction(action))
        .map(item => this.toChatItem(item as AddChatItemAction))
        .sort((c1, c2) => c1.timestamp - c2.timestamp)

      if (response.continuation?.token == null) {
        this.logService.logWarning(this, `Fetched ${chatItems.length} new chat items but continuation token is null. Ignoring chat items.`)
      } else {
        this.logService.logInfo(this, `Adding ${chatItems.length} new chat items`)

        let anyFailed = false
        for (const item of chatItems) {
          const success = await this.onNewChatItem(item)
          if (success) {
            hasNewChat = true
          } else {
            anyFailed = true
          }
        }

        if (!anyFailed) {
          // purposefully only set this AFTER everything has been added. if we set it before,
          // and something goes wrong with adding chat, the chat messages will be lost forever.
          await this.livestreamStore.setContinuationToken(response.continuation.token)
        }
      }
    }

    // if we received a new message, immediately start checking for another one
    if (hasNewChat) {
      return MIN_INTERVAL
    } else {
      const now = Date.now()
      const chat = await this.chatStore.getChatSince(now - LIMIT)
      const timestamps = chat.map(c => c.time.getTime())
      return getNextInterval(now, timestamps, createLogContext(this.logService, this))
    }
  }

  private toChatItem (item: AddChatItemAction): ChatItem {
    const messageParts = item.message.map((run: YTRun): PartialChatMessage => {
      if (isTextRun(run)) {
        return {
          type: 'text',
          text: run.text,
          isBold: run.bold ?? false,
          isItalics: run.italics ?? false
        }
      } else {
        return {
          type: 'emoji',
          emojiId: getUniqueEmojiId(run.emoji),
          name: run.emoji.image.accessibility!.accessibilityData.label,
          label: getEmojiLabel(run.emoji),
          image: run.emoji.image.thumbnails[0]!
        }
      }
    })

    return {
      id: item.id,
      timestamp: item.timestamp.getTime(),
      author: {
        name: item.authorName,
        channelId: item.authorChannelId,
        image: item.authorPhoto,
        attributes: {
          isOwner: item.isOwner,
          isModerator: item.isModerator,
          isVerified: item.isVerified
        }
      },
      messageParts
    }
  }
}

function isTextRun (run: YTRun): run is YTTextRun {
  return (run as any).emoji == null
}

function isAddChatAction (action: Action): action is AddChatItemAction {
  return action.type === 'addChatItemAction'
}

function getNextInterval (currentTime: number, timestamps: List<number> | number[], logContext: LogContext): number {
  if (!isList(timestamps)) {
    timestamps = List(timestamps)
  }

  const startTimestamp = currentTime - LIMIT

  const weightFn = clampNormFn(t => Math.sqrt(t), startTimestamp, currentTime)
  const weights = timestamps.filter(t => t >= startTimestamp).map(t => weightFn(t))

  // pretend each message was the only one sent in the period, and scale the average based on the weight. then add all.
  // this has the effect that, if there is a quick burst of messages, it won't increase the refresh rate for the whole
  // `limit` interval, but smoothly return back to normal over time.
  const chatRate = sum(weights.map(w => w / (LIMIT / 1000)))
  const nextInterval = (1 - clamp((chatRate - MIN_CHAT_RATE) / (MAX_CHAT_RATE - MIN_CHAT_RATE), 0, 1)) * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL

  logContext.logDebug(`Chat rate: ${chatRate.toFixed(4)} | Next interval: ${nextInterval.toFixed(0)}`)
  return nextInterval
}
