import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ICommand } from '@rebel/server/services/command/CommandService'
import LinkService from '@rebel/server/services/LinkService'
import { InvalidCommandArgumentsError } from '@rebel/server/util/error'

type Deps = Dependencies<{
  linkService: LinkService
}>

export default class LinkCommand extends ContextClass implements ICommand {
  public readonly normalisedNames = ['LINK']

  private readonly linkService: LinkService

  constructor (deps: Deps) {
    super()
    this.linkService = deps.resolve('linkService')
  }

  public async executeCommand (defaultUserId: number, args: string[]): Promise<string | null> {
    if (args.length !== 1) {
      throw new InvalidCommandArgumentsError(`Expected 1 argument but received ${args.length}`)
    }

    const linkToken = args[0]
    const aggregateUserId = 1 // todo: get from link token. may have to get registered user, then its aggregate user id
    await this.linkService.linkUser(defaultUserId, aggregateUserId)
    return `Successfully linked user ${defaultUserId} to ${aggregateUserId}`
  }
}
