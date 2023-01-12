import ApiService from '@rebel/server/controllers/ApiService'
import { GetChatEndpoint, IChatController } from '@rebel/server/controllers/ChatController'
import { buildPath, ControllerBase, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import AccountService from '@rebel/server/services/AccountService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore from '@rebel/server/stores/RankStore'
import { allDefined, unique } from '@rebel/server/util/arrays'
import { Path } from 'typescript-rest'

export type ChatControllerDeps = ControllerDependencies<{
  chatStore: ChatStore,
  experienceService: ExperienceService
  rankStore: RankStore
  accountStore: AccountStore
  accountService: AccountService
}>

@Path(buildPath('chat'))
export default class ChatControllerReal extends ControllerBase implements IChatController {
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService
  readonly rankStore: RankStore
  readonly accountStore: AccountStore
  readonly accountService: AccountService

  constructor (deps: ChatControllerDeps) {
    super(deps, '/chat')
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.accountService = deps.resolve('accountService')
  }

  public async getChat (args: In<GetChatEndpoint>): Out<GetChatEndpoint> {
    let { builder, limit, since } = args
    since = since ?? 0
    const streamerId = this.getStreamerId()
    const items = await this.chatStore.getChatSince(streamerId, since, undefined, limit)

    const users = items.map(c => c.user)
    if (!allDefined(users)) {
      throw new Error('Chat items must have a user set')
    }
    const primaryUserIds = unique(users.map(user => user.aggregateChatUserId ?? user.id))

    const levels = await this.experienceService.getLevels(streamerId, primaryUserIds)
    const ranks = await this.rankStore.getUserRanks(primaryUserIds, streamerId)
    const registeredUsers = await this.accountStore.getRegisteredUsers(primaryUserIds)

    let chatItems: PublicChatItem[] = []
    for (const chat of items) {
      const primaryUserId = chat.user!.aggregateChatUserId ?? chat.user!.id
      const level = levels.find(l => l.primaryUserId === primaryUserId)!.level
      const activeRanks = ranks.find(r => r.primaryUserId === primaryUserId)!.ranks.map(userRankToPublicObject)
      const registeredUser = registeredUsers.find(r => r.primaryUserId === primaryUserId)!.registeredUser
      chatItems.push(chatAndLevelToPublicChatItem(chat, level, activeRanks, registeredUser))
    }

    return builder.success({
      reusableTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: chatItems
    })
  }
}
