import { Dependencies } from '@rebel/shared/context/context'
import ChatStore from '@rebel/server/stores/ChatStore'
import { Action, AddChatItemAction, YTRun, YTTextRun } from '@rebel/masterchat'
import { ChatItem, getEmojiLabel, PartialChatMessage } from '@rebel/server/models/chat'
import { clamp, clampNormFn, sum } from '@rebel/shared/util/math'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import MasterchatService from '@rebel/server/services/MasterchatService'
import ContextClass from '@rebel/shared/context/ContextClass'
import ChatService from '@rebel/server/services/ChatService'
import StreamerStore from '@rebel/server/stores/StreamerStore'

const LIVESTREAM_CHECK_INTERVAL = 10_000

const MIN_INTERVAL = 500
const MAX_INTERVAL = 3_000
const MAX_INTERVAL_FOR_CHAT_MATE = 30_000

// this can approximately be interpreted as the number of chat messages per minute
const MIN_CHAT_RATE = 0.5 / 60
const MAX_CHAT_RATE = 10 / 60

// how far back we will look to determine the dynamic refresh rates
const LIMIT = 120_000

type Deps = Dependencies<{
  chatService: ChatService
  chatStore: ChatStore
  logService: LogService
  masterchatService: MasterchatService
  timerHelpers: TimerHelpers
  livestreamStore: LivestreamStore
  disableExternalApis: boolean
  streamerStore: StreamerStore
  chatMateRegisteredUserName: string
}>

export default class ChatFetchService extends ContextClass {
  readonly name = ChatFetchService.name
  private readonly chatService: ChatService
  private readonly chatStore: ChatStore
  private readonly logService: LogService
  private readonly masterchatService: MasterchatService
  private readonly timerHelpers: TimerHelpers
  private readonly livestreamStore: LivestreamStore
  private readonly disableExternalApis: boolean
  private readonly streamerStore: StreamerStore
  private readonly chatMateRegisteredUserName: string

  private livestreamCheckTimer!: number
  private chatTimers: Map<string, number> = new Map()
  private chatMateStreamerId: number | null = null

  constructor (deps: Deps) {
    super()
    this.chatService = deps.resolve('chatService')
    this.chatStore = deps.resolve('chatStore')
    this.masterchatService = deps.resolve('masterchatService')
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.streamerStore = deps.resolve('streamerStore')
    this.chatMateRegisteredUserName = deps.resolve('chatMateRegisteredUserName')
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    const timerOptions: TimerOptions = {
      behaviour: 'end',
      interval: LIVESTREAM_CHECK_INTERVAL,
      callback: this.checkLivestreams
    }
    this.livestreamCheckTimer = await this.timerHelpers.createRepeatingTimer(timerOptions, true)
  }

  public override dispose (): void | Promise<void> {
    this.timerHelpers.disposeSingle(this.livestreamCheckTimer)

    for (const timer of this.chatTimers.values()) {
      this.timerHelpers.disposeSingle(timer)
    }
    this.chatTimers.clear()
    this.chatMateStreamerId = null
  }

  /** Esures that there is one timer active for every YouTube livestream. */
  private checkLivestreams = async (): Promise<void> => {
    const livestreams = await this.livestreamStore.getActiveLivestreams()
    const currentIds = [...this.chatTimers.keys()]

    for (const livestream of livestreams) {
      const id = livestream.liveId
      if (currentIds.includes(id)) {
        continue
      }

      const timerOptions: TimerOptions = {
        behaviour: 'dynamicEnd',
        callback: () => this.updateLivestreamMessages(livestream.streamerId, id)
      }
      const timer = await this.timerHelpers.createRepeatingTimer(timerOptions, true)
      this.chatTimers.set(id, timer)
    }

    for (const currentId of currentIds) {
      const matchingLivestream = livestreams.find(livestream => livestream.liveId === currentId)
      if (matchingLivestream != null) {
        continue
      }

      const timer = this.chatTimers.get(currentId)!
      this.timerHelpers.disposeSingle(timer)
      this.chatTimers.delete(currentId)
    }
  }

  private updateLivestreamMessages = async (streamerId: number, liveId: string): Promise<number> => {
    const response = await this.fetchLatestMessages(streamerId)

    let hasNewChat: boolean = false
    if (response != null) {
      let chatItems = response.actions
        .filter(action => isAddChatAction(action))
        .map(item => this.toChatItem(item as AddChatItemAction))
        .sort((c1, c2) => c1.timestamp - c2.timestamp)

      if (response.continuation?.token == null) {
        this.logService.logWarning(this, `Fetched ${chatItems.length} new chat items but continuation token is null. Ignoring chat items.`)
      } else {
        if (chatItems.length > 0) {
          this.logService.logInfo(this, `Adding ${chatItems.length} new chat items for streamer ${streamerId}`)
        }

        let anyFailed = false
        for (const item of chatItems) {
          try {
            const addedNewChat = await this.chatService.onNewChatItem(item, streamerId)
            if (addedNewChat) {
              hasNewChat = true
            }
          } catch (e: any) {
            anyFailed = true
          }
        }

        if (!anyFailed) {
          // purposefully only set this AFTER everything has been added. if we set it before,
          // and something goes wrong with adding chat, the chat messages will be lost forever.
          // todo: maybe we want it to be lost forever - perhaps there was bad data in the chat message, and now we are stuck in an infinite loop...
          await this.livestreamStore.setContinuationToken(liveId, response.continuation.token)
        }
      }
    }

    // if we received a new message, immediately start checking for another one
    if (hasNewChat) {
      return MIN_INTERVAL
    } else {
      const now = Date.now()
      const chat = await this.chatStore.getChatSince(streamerId, now - LIMIT)
      const timestamps = chat.map(c => c.time.getTime())
      return this.getNextInterval(streamerId, now, timestamps)
    }
  }

  private fetchLatestMessages = async (streamerId: number) => {
    const livestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (livestream == null) {
      return null
    }

    const liveId = livestream.liveId
    const token = livestream.continuationToken

    try {
      const result = await this.masterchatService.fetch(livestream.streamerId, token ?? undefined)
      return result
    } catch (e: any) {
      this.logService.logError(this, `Encountered error while fetching chat for livestream ${livestream.id} for streamer ${livestream.streamerId}:`, e.message)
      await this.livestreamStore.setContinuationToken(liveId, null)
      return null
    }
  }

  private toChatItem (item: AddChatItemAction): ChatItem {
    const messageParts = item.message!.map((run: YTRun): PartialChatMessage => {
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
          name: run.emoji.image.accessibility!.accessibilityData.label,
          label: getEmojiLabel(run.emoji),
          image: run.emoji.image.thumbnails[0]!
        }
      }
    })

    return {
      id: item.id,
      timestamp: item.timestamp.getTime(),
      platform: 'youtube',
      contextToken: item.contextMenuEndpointParams,
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

  private async getNextInterval (streamerId: number, currentTime: number, timestamps: number[]): Promise<number> {
    if (await this.isChatMateStreamer(streamerId) && timestamps.length === 0) {
      // to avoid spamming the logs and reduce the chance of YouTube getting upset with us, we don't poll the chat of the official
      // ChatMate streamer very often if there haven't been recent messages.
      return MAX_INTERVAL_FOR_CHAT_MATE
    }

    const startTimestamp = currentTime - LIMIT

    const weightFn = clampNormFn(t => Math.sqrt(t), startTimestamp, currentTime)
    const weights = timestamps.filter(t => t >= startTimestamp).map(t => weightFn(t))

    // pretend each message was the only one sent in the period, and scale the average based on the weight. then add all.
    // this has the effect that, if there is a quick burst of messages, it won't increase the refresh rate for the whole
    // `limit` interval, but smoothly return back to normal over time.
    const chatRate = sum(weights.map(w => w / (LIMIT / 1000)))
    const nextInterval = (1 - clamp((chatRate - MIN_CHAT_RATE) / (MAX_CHAT_RATE - MIN_CHAT_RATE), 0, 1)) * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL

    return nextInterval
  }

  private async isChatMateStreamer (streamerId: number): Promise<boolean> {
    // the streamer id is cached
    if (this.chatMateStreamerId == null) {
      const chatMateStreamer = await this.streamerStore.getStreamerByName(this.chatMateRegisteredUserName)
      if (chatMateStreamer == null) {
        this.logService.logWarning(this, 'Could not find the official ChatMate streamer.')
        return false
      }

      this.chatMateStreamerId = chatMateStreamer.id
    }

    return this.chatMateStreamerId === streamerId
  }
}

function isTextRun (run: YTRun): run is YTTextRun {
  return (run as any).emoji == null
}

function isAddChatAction (action: Action): action is AddChatItemAction {
  return action.type === 'addChatItemAction' && (action.message?.length ?? 0) > 0
}
