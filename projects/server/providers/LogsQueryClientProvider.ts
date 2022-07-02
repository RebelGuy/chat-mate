import { AzureCliCredential, DefaultAzureCredential, EnvironmentCredential, useIdentityPlugin, VisualStudioCodeCredential } from '@azure/identity'
import { LogsQueryClient } from '@azure/monitor-query'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import { vsCodePlugin } from '@azure/identity-vscode'

type Deps = Dependencies<{
  managedIdentityClientId: string | null
}>

export default class LogsQueryClientProvider extends ContextClass implements IProvider<LogsQueryClient> {
  private readonly logsQueryClient: LogsQueryClient

  constructor (deps: Deps) {
    super()

    useIdentityPlugin(vsCodePlugin)

    // https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/identity/identity/samples/AzureIdentityExamples.md#authenticating-a-user-assigned-managed-identity-with-defaultazurecredential
    const managedIdentityClientId = deps.resolve('managedIdentityClientId')
    const credential = new DefaultAzureCredential({ managedIdentityClientId: managedIdentityClientId ?? undefined })
    // const credential = new VisualStudioCodeCredential()
    this.logsQueryClient = new LogsQueryClient(credential)
    
  }

  get () {
    return this.logsQueryClient
  }
}
