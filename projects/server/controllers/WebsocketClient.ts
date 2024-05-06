import ApiService from '@rebel/server/controllers/ApiService'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { RawData, WebSocket } from 'ws'
import { Request } from 'express'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import LogService from '@rebel/server/services/LogService'
import { ServerMessage, parseClientMessage } from '@rebel/api-models/websocket'
import EventDispatchService, { EVENT_PUBLIC_CHAT_ITEM, EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, EventData } from '@rebel/server/services/EventDispatchService'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import ChatService from '@rebel/server/services/ChatService'
import { PublicLevelUpData } from '@rebel/api-models/public/event/PublicLevelUpData'
import { userDataToPublicUser } from '@rebel/server/models/user'

const emptyPublicChatMateEvent = {
  levelUpData: null,
  newTwitchFollowerData: null,
  donationData: null,
  newViewerData: null,
  chatMessageDeletedData: null,
  rankUpdateData: null
}

type Deps = Dependencies<{
  request: Request
  apiService: ApiService
  wsClient: WebSocket
  logService: LogService
  eventDispatchService: EventDispatchService
  chatStore: ChatStore,
  experienceService: ExperienceService
  rankStore: RankStore
  accountStore: AccountStore
  streamerStore: StreamerStore
  chatService: ChatService
}>

let id = 0

export default class WebsocketClient extends ContextClass {
  public readonly name

  private readonly request: Request
  private readonly apiService: ApiService
  private readonly wsClient: WebSocket
  private readonly logService: LogService
  private readonly eventDispatchService: EventDispatchService
  private readonly chatStore: ChatStore
  private readonly experienceService: ExperienceService
  private readonly rankStore: RankStore
  private readonly accountStore: AccountStore
  private readonly streamerStore: StreamerStore
  private readonly chatService: ChatService

  private readonly id: number

  constructor (deps: Deps) {
    super()

    this.request = deps.resolve('request')
    this.apiService = deps.resolve('apiService')
    this.wsClient = deps.resolve('wsClient')
    this.logService = deps.resolve('logService')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.streamerStore = deps.resolve('streamerStore')
    this.chatService = deps.resolve('chatService')

    this.id = id++
    this.name = `${WebsocketClient.name}-${this.id}`
  }

  public override initialise (): void | Promise<void> {
    this.wsClient.on('open', this.onOpen)
    this.wsClient.on('message', this.onMessage)
    this.wsClient.on('close', this.onClose)
    this.wsClient.on('error', this.onError)

    if (this.getState() === 'open') {
      this.onOpen()
    }
  }

  public override dispose (): void | Promise<void> {
    this.close()

    this.wsClient.off('open', this.onOpen)
    this.wsClient.off('message', this.onMessage)
    this.wsClient.off('close', this.onClose)
    this.wsClient.off('error', this.onError)

    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_ITEM, this.onChat)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, this.onLevelUp)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, this.onNewFollower)
  }

  private onOpen = () => {
    this.logService.logInfo(this, `Websocket connection established`)
  }

  private onMessage = (data: RawData, isBinary: boolean) => {
    const parsedMessage = isBinary ? null : parseClientMessage(data)

    if (parsedMessage == null) {
      this.send({ type: 'acknowledge', data: { success: false }})
      return
    }

    // todo: keep track of which streamers' events we are listening for

    if (parsedMessage.type === 'subscribe') {
      if (parsedMessage.data.topic === 'streamerChat') {
        if (!this.eventDispatchService.isListening(EVENT_PUBLIC_CHAT_ITEM, this.onChat)) {
          this.eventDispatchService.onData(EVENT_PUBLIC_CHAT_ITEM, this.onChat)
        }
      } else if (parsedMessage.data.topic === 'streamerEvents') {
        if (!this.eventDispatchService.isListening(EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, this.onLevelUp)) {
          this.eventDispatchService.onData(EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, this.onLevelUp)
        }
        if (!this.eventDispatchService.isListening(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, this.onNewFollower)) {
          this.eventDispatchService.onData(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, this.onNewFollower)
        }
      } else {
        assertUnreachable(parsedMessage.data.topic)
      }
    } else if (parsedMessage.type === 'unsubscribe') {
      if (parsedMessage.data.topic === 'streamerChat') {
        this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_ITEM, this.onChat)
      } else if (parsedMessage.data.topic === 'streamerEvents') {
        this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, this.onLevelUp)
        this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, this.onNewFollower)
      } else {
        assertUnreachable(parsedMessage.data.topic)
      }
    } else {
      assertUnreachable(parsedMessage)
    }

    this.send({ type: 'acknowledge', data: { success: true }})
  }

  private onClose = (code: number, reason: Buffer) => {
    this.logService.logInfo(this, `Websocket connection closed with code ${code}. Reason:`, reason)

    void this.dispose()
  }

  private onError = (error: Error) => {
    this.logService.logError(this, `Websocket connection errored:`, error)
  }

  private onChat = async (chatData: EventData[typeof EVENT_PUBLIC_CHAT_ITEM]) => {
    try {
      const chat = await this.chatService.getChatById(chatData.id)
      if (chat.user == null) {
        this.logService.logError(this, `Chat item with ID ${chat.id} does not have a user object set and cannot be processed`)
        return
      }

      const streamerId = chat.streamerId
      const primaryUserId = getPrimaryUserId(chat.user)
      const [levelResult, ranksResult, registeredUserResult, firstSeenResult, customRankNamesResult, streamerName] = await Promise.all([
        this.experienceService.getLevels(streamerId, [primaryUserId]).then(single),
        this.rankStore.getUserRanks([primaryUserId], streamerId).then(single),
        this.accountStore.getRegisteredUsers([primaryUserId]).then(single),
        this.chatStore.getTimeOfFirstChat(streamerId, [primaryUserId]).then(single),
        this.rankStore.getCustomRankNamesForUsers(streamerId, [primaryUserId]).then(single),
        this.getStreamerName(streamerId)
      ])
      const activeRanks = ranksResult.ranks.map(r => userRankToPublicObject(r, customRankNamesResult.customRankNames[r.rank.name]))
      const publicChatItem = chatAndLevelToPublicChatItem(chat, levelResult.level, activeRanks, registeredUserResult.registeredUser, firstSeenResult.firstSeen)

      this.send({
        type: 'event',
        data: {
          topic: 'streamerChat',
          streamer: streamerName,
          data: publicChatItem
        }
      })
    } catch (e: any) {
      this.logService.logError(this, 'Unable to dispatch chat event', chatData, e)
    }
  }

  private onLevelUp = async (event: EventData[typeof EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP]) => {
    try {
      const [streamerName, data] = await Promise.all([
        this.getStreamerName(event.streamerId),
        this.apiService.getAllData([event.primaryUserId], event.streamerId).then(single)
      ])

      const publicLevelUpData: PublicLevelUpData = {
        user: userDataToPublicUser(data),
        oldLevel: event.oldLevel.level,
        newLevel: event.newLevel.level,
      }

      this.send({
        type: 'event',
        data: {
          topic: 'streamerEvents',
          streamer: streamerName,
          data: {
            ...emptyPublicChatMateEvent,
            type: 'levelUp',
            timestamp: Date.now(),
            levelUpData: publicLevelUpData
          }
        }
      })
    } catch (e: any) {
      this.logService.logError(this, 'Unable to dispatch level up event', event, e)
    }
  }

  private onNewFollower = async (event: EventData[typeof EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER]) => {
    try {
      this.send({
        type: 'event',
        data: {
          topic: 'streamerEvents',
          streamer: await this.getStreamerName(event.streamerId),
          data: {
            ...emptyPublicChatMateEvent,
            type: 'newTwitchFollower',
            timestamp: Date.now(),
            newTwitchFollowerData: { displayName: event.userDisplayName }
          }
        }
      })
    } catch (e: any) {
      this.logService.logError(this, 'Unable to dispatch new follower event', event, e)
    }
  }

  private async getStreamerName (streamerId: number) {
    const streamer = await this.streamerStore.getStreamerById(streamerId)
    const registeredUser = await this.accountStore.getRegisteredUsersFromIds([streamer!.registeredUserId]).then(single)
    return registeredUser.username
  }

  private getState () {
    if (this.wsClient.readyState === this.wsClient.CONNECTING) {
      return 'connecting'
    } else if (this.wsClient.readyState === this.wsClient.OPEN) {
      return 'open'
    } else if (this.wsClient.readyState === this.wsClient.CLOSING) {
      return 'closing'
    } else if (this.wsClient.readyState === this.wsClient.CLOSED) {
      return 'closed'
    } else {
      assertUnreachable(this.wsClient.readyState)
    }
  }

  private close () {
    if (this.getState() !== 'open') {
      return
    }

    this.wsClient.close()
  }

  private send (message: ServerMessage) {
    this.wsClient.send(JSON.stringify(message), error => {
      if (error != null) {
        this.logService.logError(this, 'Failed to send message', message, 'because of an error:', error)
      }
    })
  }

  // this should handle messages and route them to the correct service.
  // it should also subscribe to chatmate internal events and notify subscribed clients.
  // since this is a transient service, all state needs to be stored in a stateservice
}
