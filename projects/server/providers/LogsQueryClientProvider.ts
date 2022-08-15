import { DefaultAzureCredential, useIdentityPlugin } from '@azure/identity'
import { LogsQueryClient } from '@azure/monitor-query'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { NodeEnv } from '@rebel/server/globals'
import IProvider from '@rebel/server/providers/IProvider'

type Deps = Dependencies<{
  managedIdentityClientId: string | null
  nodeEnv: NodeEnv
}>

export default class LogsQueryClientProvider extends ContextClass implements IProvider<LogsQueryClient> {
  private readonly logsQueryClient: LogsQueryClient

  constructor (deps: Deps) {
    super()

    // register the VSCode plugin for authentication
    if (deps.resolve('nodeEnv') === 'local') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const identityVsCode = require('@azure/identity-vscode')
      useIdentityPlugin(identityVsCode.vsCodePlugin)
    }

    // https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/identity/identity/samples/AzureIdentityExamples.md#authenticating-a-user-assigned-managed-identity-with-defaultazurecredential
    const managedIdentityClientId = deps.resolve('managedIdentityClientId')

    // it will try a number of authentication methods until one works.
    const credential = new DefaultAzureCredential({ managedIdentityClientId: managedIdentityClientId ?? undefined })
    this.logsQueryClient = new LogsQueryClient(credential)
    
  }

  get () {
    return this.logsQueryClient
  }
}
