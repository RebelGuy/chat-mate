import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ICommand } from '@rebel/server/services/command/CommandService'
import LinkService from '@rebel/server/services/LinkService'
import LinkStore from '@rebel/server/stores/LinkStore'
import { InvalidCommandArgumentsError } from '@rebel/server/util/error'

type Deps = Dependencies<{
  linkService: LinkService
  linkStore: LinkStore
}>

export default class LinkCommand extends ContextClass implements ICommand {
  public readonly normalisedNames = ['LINK']

  private readonly linkService: LinkService
  private readonly linkStore: LinkStore

  constructor (deps: Deps) {
    super()
    this.linkService = deps.resolve('linkService')
    this.linkStore = deps.resolve('linkStore')
  }

  public async executeCommand (defaultUserId: number, args: string[]): Promise<string | null> {
    if (args.length !== 1) {
      throw new InvalidCommandArgumentsError(`Expected 1 argument but received ${args.length}`)
    }

    const linkToken = args[0]
    const validatedToken = await this.linkStore.validateLinkToken(defaultUserId, linkToken)
    if (validatedToken == null) {
      throw new InvalidCommandArgumentsError(`Invalid token ${linkToken}`)
    }

    const aggregateUserId = validatedToken.aggregateChatUserId
    await this.linkService.linkUser(defaultUserId, aggregateUserId, validatedToken.token)
    return `Successfully linked user ${defaultUserId} to ${aggregateUserId}`
  }
}
