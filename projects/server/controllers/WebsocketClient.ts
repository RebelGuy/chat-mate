import ApiService from '@rebel/server/controllers/ApiService'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { RawData, WebSocket } from 'ws'
import { Request } from 'express'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import LogService from '@rebel/server/services/LogService'
import { ServerMessage, StreamerTopic, parseClientMessage } from '@rebel/api-models/websocket'
import EventDispatchService, { EVENT_PUBLIC_CHAT_ITEM, EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION, EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER, EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE, EventData } from '@rebel/server/services/EventDispatchService'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import { chatAndLevelToPublicChatItem, toPublicMessagePart } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import ChatService from '@rebel/server/services/ChatService'
import { PublicLevelUpData } from '@rebel/api-models/public/event/PublicLevelUpData'
import { userDataToPublicUser } from '@rebel/server/models/user'
import { ExternalRank } from '@rebel/server/services/rank/RankService'
import { PublicPlatformRank } from '@rebel/api-models/public/event/PublicPlatformRank'
import { getUserName } from '@rebel/server/services/ChannelService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { NotFoundError } from '@rebel/shared/util/error'

const emptyPublicChatMateEvent = {
  levelUpData: null,
  newTwitchFollowerData: null,
  donationData: null,
  newViewerData: null,
  chatMessageDeletedData: null,
  rankUpdateData: null
}

type ResolvedSubscription = `${StreamerTopic}-${number}`

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
  channelStore: ChannelStore
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
  private readonly channelStore: ChannelStore

  private readonly id: number

  private subscriptions: Set<ResolvedSubscription>

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
    this.channelStore = deps.resolve('channelStore')

    this.id = id++
    this.name = `${WebsocketClient.name}-${this.id}`
    this.subscriptions = new Set()
  }

  public override initialise (): void | Promise<void> {
    this.wsClient.on('open', this.onOpen)
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.wsClient.off('message', this.onMessage)
    this.wsClient.off('close', this.onClose)
    this.wsClient.off('error', this.onError)

    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_ITEM, this.onChat)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, this.onLevelUp)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, this.onNewFollower)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION, this.onDonation)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER, this.onNewViewer)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, this.onMessageDeleted)
    this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE, this.onRankUpdate)

    this.subscriptions = new Set()
  }

  private onOpen = () => {
    this.logService.logInfo(this, `Websocket connection established`)
  }

  private onMessage = async (data: RawData, isBinary: boolean) => {
    try {
      const parsedMessage = isBinary ? null : parseClientMessage(data)

      if (parsedMessage == null) {
        this.send({ type: 'acknowledge', data: { success: false }})
        return
      }

      const resolvedTopic = await this.getResolvedSubscription(parsedMessage.data)

      if (parsedMessage.type === 'subscribe') {
        this.subscriptions.add(resolvedTopic)

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
          if (!this.eventDispatchService.isListening(EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION, this.onDonation)) {
            this.eventDispatchService.onData(EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION, this.onDonation)
          }
          if (!this.eventDispatchService.isListening(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER, this.onNewViewer)) {
            this.eventDispatchService.onData(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER, this.onNewViewer)
          }
          if (!this.eventDispatchService.isListening(EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, this.onMessageDeleted)) {
            this.eventDispatchService.onData(EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, this.onMessageDeleted)
          }
          if (!this.eventDispatchService.isListening(EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE, this.onRankUpdate)) {
            this.eventDispatchService.onData(EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE, this.onRankUpdate)
          }
        } else {
          assertUnreachable(parsedMessage.data.topic)
        }

      } else if (parsedMessage.type === 'unsubscribe') {
        this.subscriptions.add(resolvedTopic)

        if (parsedMessage.data.topic === 'streamerChat') {
          this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_ITEM, this.onChat)
        } else if (parsedMessage.data.topic === 'streamerEvents') {
          this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_LEVEL_UP, this.onLevelUp)
          this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, this.onNewFollower)
          this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION, this.onDonation)
          this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER, this.onNewViewer)
          this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, this.onMessageDeleted)
          this.eventDispatchService.unsubscribe(EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE, this.onRankUpdate)
        } else {
          assertUnreachable(parsedMessage.data.topic)
        }

      } else {
        assertUnreachable(parsedMessage)
      }

      this.send({ type: 'acknowledge', data: { success: true }})

    } catch (e: any) {
      this.logService.logError(this, 'Encountered error in the onMessage handler for data', data, e)
    }
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
      const requiredSubscription = await this.getResolvedSubscription('streamerChat', chatData.streamerId)
      if (!this.subscriptions.has(requiredSubscription)) {
        return
      }

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
      const requiredSubscription = await this.getResolvedSubscription('streamerEvents', event.streamerId)
      if (!this.subscriptions.has(requiredSubscription)) {
        return
      }

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
      const requiredSubscription = await this.getResolvedSubscription('streamerEvents', event.streamerId)
      if (!this.subscriptions.has(requiredSubscription)) {
        return
      }

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

  private onDonation = async (event: EventData[typeof EVENT_PUBLIC_CHAT_MATE_EVENT_DONATION]) => {
    try {
      const requiredSubscription = await this.getResolvedSubscription('streamerEvents', event.streamerId)
      if (!this.subscriptions.has(requiredSubscription)) {
        return
      }

      const user = event.primaryUserId == null ? null : await this.apiService.getAllData([event.primaryUserId], event.streamerId)
        .then(single)
        .then(userDataToPublicUser)

      this.send({
        type: 'event',
        data: {
          topic: 'streamerEvents',
          streamer: await this.getStreamerName(event.streamerId),
          data: {
            ...emptyPublicChatMateEvent,
            type: 'donation',
            timestamp: Date.now(),
            donationData: {
              id: event.id,
              time: event.time.getTime(),
              amount: event.amount,
              formattedAmount: event.formattedAmount,
              currency: event.currency,
              name: event.name,
              messageParts: event.messageParts.map(toPublicMessagePart),
              linkedUser: user
            }
          }
        }
      })
    } catch (e: any) {
      this.logService.logError(this, 'Unable to dispatch donation event', event, e)
    }
  }

  private onNewViewer = async (event: EventData[typeof EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER]) => {
    try {
      const requiredSubscription = await this.getResolvedSubscription('streamerEvents', event.streamerId)
      if (!this.subscriptions.has(requiredSubscription)) {
        return
      }

      const userData = await this.apiService.getAllData([event.primaryUserId], event.streamerId).then(single)

      this.send({
        type: 'event',
        data: {
          topic: 'streamerEvents',
          streamer: await this.getStreamerName(event.streamerId),
          data: {
            ...emptyPublicChatMateEvent,
            type: 'newViewer',
            timestamp: Date.now(),
            newViewerData: {
              user: userDataToPublicUser(userData)
            }
          }
        }
      })
    } catch (e: any) {
      this.logService.logError(this, 'Unable to dispatch new viewer event', event, e)
    }
  }

  private onMessageDeleted = async (event: EventData[typeof EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED]) => {
    try {
      const requiredSubscription = await this.getResolvedSubscription('streamerEvents', event.streamerId)
      if (!this.subscriptions.has(requiredSubscription)) {
        return
      }

      this.send({
        type: 'event',
        data: {
          topic: 'streamerEvents',
          streamer: await this.getStreamerName(event.streamerId),
          data: {
            ...emptyPublicChatMateEvent,
            type: 'chatMessageDeleted',
            timestamp: Date.now(),
            chatMessageDeletedData: {
              chatMessageId: event.chatMessageId
            }
          }
        }
      })
    } catch (e: any) {
      this.logService.logError(this, 'Unable to dispatch message deleted event', event, e)
    }
  }

  // todo: when you're not drunk, confirm the ignoreOptions are handled correctly here. i have no recollection of how they work lol
  private onRankUpdate = async (event: EventData[typeof EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE]) => {
    try {
      const requiredSubscription = await this.getResolvedSubscription('streamerEvents', event.streamerId)
      if (!this.subscriptions.has(requiredSubscription)) {
        return
      }

      const rankEvent = event.rankEvent
      const userData = await this.apiService.getAllData([rankEvent.userId], event.streamerId).then(single)
      const youtubeRankResults = rankEvent.data?.youtubeRankResults ?? []
      const twitchRankResults = rankEvent.data?.twitchRankResults ?? []
      const ignoreOptions = rankEvent.data?.ignoreOptions ?? null

      let youtubeChannelIds = youtubeRankResults.map(r => r.youtubeChannelId)
      if (ignoreOptions?.youtubeChannelId != null) {
        youtubeChannelIds.push(ignoreOptions.youtubeChannelId)
      }
      let twitchChannelIds = twitchRankResults.map(r => r.twitchChannelId)
      if (ignoreOptions?.twitchChannelId != null) {
        twitchChannelIds.push(ignoreOptions.twitchChannelId)
      }
      const [youtubeChannels, twitchChannels] = await Promise.all([
        this.channelStore.getYoutubeChannelsFromChannelIds(youtubeChannelIds),
        this.channelStore.getTwitchChannelsFromChannelIds(twitchChannelIds)
      ])

      let platformRanks: PublicPlatformRank[] = [
        ...youtubeRankResults.map<PublicPlatformRank>(r => {
          const channel = youtubeChannels.find(c => c.platformInfo.channel.id === r.youtubeChannelId)!
          return { platform: 'youtube', channelName: getUserName(channel), success: r.error == null }
        }),
        ...twitchRankResults.map<PublicPlatformRank>(r => {
          const channel = twitchChannels.find(c => c.platformInfo.channel.id === r.twitchChannelId)!
          return { platform: 'twitch', channelName: getUserName(channel), success: r.error == null }
        })
      ]

      if (ignoreOptions?.youtubeChannelId != null) {
        const channel = youtubeChannels.find(c => c.platformInfo.channel.id === ignoreOptions.youtubeChannelId)!
        platformRanks.unshift({ platform: 'youtube', channelName: getUserName(channel), success: true })
      } else if (ignoreOptions?.twitchChannelId != null) {
        const channel = twitchChannels.find(c => c.platformInfo.channel.id === ignoreOptions.twitchChannelId)!
        platformRanks.push({ platform: 'twitch', channelName: getUserName(channel), success: true })
      }

      this.send({
        type: 'event',
        data: {
          topic: 'streamerEvents',
          streamer: await this.getStreamerName(event.streamerId),
          data: {
            ...emptyPublicChatMateEvent,
            type: 'rankUpdate',
            timestamp: Date.now(),
            rankUpdateData: {
              rankName: rankEvent.rank.name as ExternalRank,
              isAdded: rankEvent.isAdded,
              user: userDataToPublicUser(userData),
              platformRanks: platformRanks
            }
          }
        }
      })
    } catch (e: any) {
      this.logService.logError(this, 'Unable to dispatch rank update event', event, e)
    }
  }

  private async getStreamerName (streamerId: number) {
    const streamer = await this.streamerStore.getStreamerById(streamerId)
    if (streamer == null) {
      throw new NotFoundError(`Unable to find streamer with id ${streamerId}`)
    }

    const registeredUser = await this.accountStore.getRegisteredUsersFromIds([streamer.registeredUserId]).then(single)
    return registeredUser.username
  }

  private async getStreamerId (streamerName: string) {
    const streamer = await this.streamerStore.getStreamerByName(streamerName)
    if (streamer == null) {
      throw new NotFoundError(`Unable to find streamer with name ${streamerName}`)
    }

    return streamer.id
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

  private async getResolvedSubscription (data: { topic: StreamerTopic, streamer: string }): Promise<ResolvedSubscription>
  private async getResolvedSubscription (topic: StreamerTopic, streamerId: number): Promise<ResolvedSubscription>
  private async getResolvedSubscription (dataOrTopic: { topic: StreamerTopic, streamer: string } | StreamerTopic, streamerId?: number): Promise<ResolvedSubscription> {
    if (streamerId == null) {
      const data = dataOrTopic as { topic: StreamerTopic, streamer: string }
      streamerId = await this.getStreamerId(data.streamer)
      return `${data.topic}-${streamerId}`
    } else {
      const topic = dataOrTopic as StreamerTopic
      return `${topic}-${streamerId}`
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
}
