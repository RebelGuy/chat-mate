import { buildPath, ControllerBase, ControllerDependencies, Endpoint } from '@rebel/server/controllers/ControllerBase'
import { GET, Path, PathParam, PreProcessor, QueryParam } from 'typescript-rest'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'
import { GetChatResponse, GetCommandStatusResponse } from '@rebel/api-models/schema/chat'
import { isKnownPrismaError, PRISMA_CODE_DOES_NOT_EXIST } from '@rebel/server/prismaUtil'
import AccountService, { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ChatService from '@rebel/server/services/ChatService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import CommandStore from '@rebel/server/stores/CommandStore'
import RankStore from '@rebel/server/stores/RankStore'
import { generateInclusiveNumberRangeValidator } from '@rebel/server/controllers/validation'
import { PublicChatItem } from '@rebel/api-models/public/chat/PublicChatItem'
import { chatAndLevelToPublicChatItem } from '@rebel/server/models/chat'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { allDefined, unique } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'

export type GetChatEndpoint = Endpoint<{ since?: number, limit?: number }, GetChatResponse>

export type GetCommandStatusEndpoint = Endpoint<{ commandId: number }, GetCommandStatusResponse>

type Deps = ControllerDependencies<{
  chatStore: ChatStore,
  experienceService: ExperienceService
  rankStore: RankStore
  accountStore: AccountStore
  accountService: AccountService
  commandStore: CommandStore
  chatService: ChatService
}>

@Path(buildPath('chat'))
@PreProcessor(requireStreamer)
export default class ChatController extends ControllerBase {
  readonly chatStore: ChatStore
  readonly experienceService: ExperienceService
  readonly rankStore: RankStore
  readonly accountStore: AccountStore
  readonly accountService: AccountService
  readonly commandStore: CommandStore
  readonly chatService: ChatService

  constructor (deps: Deps) {
    super(deps, 'chat')
    this.chatStore = deps.resolve('chatStore')
    this.experienceService = deps.resolve('experienceService')
    this.rankStore = deps.resolve('rankStore')
    this.accountStore = deps.resolve('accountStore')
    this.accountService = deps.resolve('accountService')
    this.commandStore = deps.resolve('commandStore')
    this.chatService = deps.resolve('chatService')
  }

  @GET
  public async getChat (
    @QueryParam('since') since?: number,
    @QueryParam('limit') limit?: number
  ): Promise<GetChatResponse> {
    const builder = this.registerResponseBuilder<GetChatResponse>('GET /')

    const validationError = builder.validateInput({
      since: { type: 'number', optional: true, validators: [generateInclusiveNumberRangeValidator(0, Date.now())] },
      limit: { type: 'number', optional: true, validators: [generateInclusiveNumberRangeValidator(1, 100)] }
    }, { since, limit })
    if (validationError != null) {
      return validationError
    }

    since = since ?? 0
    limit = Math.min(limit ?? 100, 100)

    try {
      const streamerId = this.getStreamerId()
      const items = await this.chatService.getChatSince(streamerId, since, undefined, limit)

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
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('/command/:commandId')
  @PreProcessor(requireRank('owner'))
  public async getCommandStatus (
    @PathParam('commandId') commandId: number
  ): Promise<GetCommandStatusResponse> {
    const builder = this.registerResponseBuilder<GetCommandStatusResponse>('GET /command/:commandId')

    const validationError = builder.validateInput({ commandId: { type: 'number' }}, { commandId })
    if (validationError != null) {
      return validationError
    }

    try {
      const command = await this.commandStore.getCommand(commandId)

      return builder.success({
        status: command.result != null ? 'success' : command.error != null ? 'error' : 'pending',
        message: command.result ?? command.error ?? null,
        durationMs: command.endTime != null && command.startTime != null ? command.endTime.getTime() - command.startTime.getTime() : null
      })
    } catch (e: any) {
      if (isKnownPrismaError(e) && e.innerError.code === PRISMA_CODE_DOES_NOT_EXIST) {
        return builder.failure(404, 'Command not found.')
      } else {
        return builder.failure(e)
      }
    }
  }
}
