import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import * as AI from 'applicationinsights'

type Deps = Dependencies<{
  isLocal: boolean
  applicationInsightsConnectionString: string
}>

export default class ApplicationInsightsService extends ContextClass {
  private readonly client: AI.TelemetryClient | null

  constructor (deps: Deps) {
    super()

    if (deps.resolve('isLocal')) {
      this.client = null
    } else {
      console.debug('Starting ApplicationInsights client...')
      AI.setup(deps.resolve('applicationInsightsConnectionString'))
        .setAutoCollectConsole(true, true)
        .setSendLiveMetrics(true) // so we can monitor the app in real-time
        .start()
      this.client = AI.defaultClient
      console.debug('Successfully started ApplicationInsights client')
    }
  }

  public trackException (args: any[]) {
    if (this.client == null) {
      return
    }

    let errors: Error[] = args.filter(arg => arg instanceof Error)
    let data = args.filter(arg => !(arg instanceof Error))

    for (const error of errors) {
      this.client.trackException({
        exception: error,
        properties: {
          additionalData: data
        }
      })
    }
  }
}
