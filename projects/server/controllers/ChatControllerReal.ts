import { GetChatEndpoint, GetCommandStatusEndpoint, IChatController } from '@rebel/server/controllers/ChatController'
import { buildPath, ControllerBase, ControllerDependencies, In, Out } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/api-models/public/chat/PublicChatItem'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import AccountService, { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import CommandStore from '@rebel/server/stores/CommandStore'
import RankStore from '@rebel/server/stores/RankStore'
import { allDefined, unique } from '@rebel/shared/util/arrays'
import { Path } from 'typescript-rest'
import { ChatMateError } from '@rebel/shared/util/error'

export type ChatControllerDeps = ControllerDependencies<{
  chatStore: ChatStore,
  experienceService: ExperienceService
  rankStore: RankStore
  accountStore: AccountStore
  accountService: AccountService
  commandStore: CommandStore
}>

@Path(buildPath('chat'))
export default class ChatControllerReal extends ControllerBase implements IChatController {
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService
  readonly rankStore: RankStore
  readonly accountStore: AccountStore
  readonly accountService: AccountService
  readonly commandStore: CommandStore

  constructor (deps: ChatControllerDeps) {
    super(deps, '/chat')
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.accountService = deps.resolve('accountService')
    this.commandStore = deps.resolve('commandStore')
  }

  public async getChat (args: In<GetChatEndpoint>): Out<GetChatEndpoint> {
    let { builder, limit, since } = args
    since = since ?? 0
    const streamerId = this.getStreamerId()
    const items = await this.chatStore.getChatSince(streamerId, since, undefined, limit)

    const users = items.map(c => c.user)
    if (!allDefined(users)) {
      throw new ChatMateError('Chat items must have a user set')
    }
    const primaryUserIds = unique(users.map(getPrimaryUserId))

    const [levels, ranks, registeredUsers, firstSeens, customRankNames] = await Promise.all([
      this.experienceService.getLevels(streamerId, primaryUserIds),
      this.rankStore.getUserRanks(primaryUserIds, streamerId),
      this.accountStore.getRegisteredUsers(primaryUserIds),
      this.chatStore.getTimeOfFirstChat(streamerId, primaryUserIds),
      this.rankStore.getCustomRankNamesForUsers(streamerId, primaryUserIds)
    ])

    let chatItems: PublicChatItem[] = []
    for (const chat of items) {
      const primaryUserId = getPrimaryUserId(chat.user!)
      const level = levels.find(l => l.primaryUserId === primaryUserId)!.level
      const customRankNamesForUser = customRankNames.find(r => r.primaryUserId === primaryUserId)!.customRankNames
      const activeRanks = ranks.find(r => r.primaryUserId === primaryUserId)!.ranks.map(r => userRankToPublicObject(r, customRankNamesForUser[r.rank.name]))
      const registeredUser = registeredUsers.find(r => r.primaryUserId === primaryUserId)!.registeredUser
      const firstSeen = firstSeens.find(f => f.primaryUserId === primaryUserId)!.firstSeen
      chatItems.push(chatAndLevelToPublicChatItem(chat, level, activeRanks, registeredUser, firstSeen))
    }

    return builder.success({
      reusableTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: chatItems
    })
  }

  public async getCommandStatus (args: In<GetCommandStatusEndpoint>): Out<GetCommandStatusEndpoint> {
    const { builder, commandId } = args

    const command = await this.commandStore.getCommand(commandId)

    return builder.success({
      status: command.result != null ? 'success' : command.error != null ? 'error' : 'pending',
      message: command.result ?? command.error ?? null,
      durationMs: command.endTime != null && command.startTime != null ? command.endTime.getTime() - command.startTime.getTime() : null
    })
  }
}
