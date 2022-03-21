import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService from '@rebel/server/services/LogService'
import { ChatClient } from '@twurple/chat/lib'
import { LoggerOverrideConfig } from '@d-fischer/logger/lib/CustomLoggerWrapper'

type Deps = Dependencies<{
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
  twitchChannelName: string
}>

export default class TwurpleChatClientProvider extends ContextClass implements IProvider<ChatClient> {
  readonly name = TwurpleChatClientProvider.name

  private readonly auth: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly twitchChannelName: string
  private readonly chatClient: ChatClient

  constructor (deps: Deps) {
    super()
    this.auth = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.twitchChannelName = deps.resolve('twitchChannelName')

    this.chatClient = new ChatClient({
      authProvider: this.auth.get(),
      channels: [this.twitchChannelName],
      isAlwaysMod: true,

      // inject custom logging
      logger: { custom: this.makeLogger() }
    })
  }

  override async initialise (): Promise<void> {
    await this.chatClient.connect()

    this.logService.logInfo(this, 'Connected to the Twurple chat client')
  }

  override async dispose (): Promise<void> {
    await this.chatClient.quit()
    
    this.logService.logInfo(this, 'Disconnected from the Twurple chat client')
  }

  get () {
    return this.chatClient
  }

  private makeLogger (): LoggerOverrideConfig {
    // todo
    return {

    } as any
  }
}
