import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { assertUnreachable } from '@rebel/server/util/typescript'
import * as AI from 'applicationinsights'
import { SeverityLevel } from 'applicationinsights/out/Declarations/Contracts'

type Deps = Dependencies<{
  applicationInsightsConnectionString: string | null
}>

export default class ApplicationInsightsService extends ContextClass {
  private readonly client: AI.TelemetryClient | null

  constructor (deps: Deps) {
    super()

    const connectionString = deps.resolve('applicationInsightsConnectionString')
    if (connectionString == null) {
      this.client = null
    } else {
      console.debug('Starting ApplicationInsights client...')
      AI.setup(connectionString)
        .setAutoCollectConsole(false) // doesn't seem to work properly - instead, we manually track these via `trackTrace()` for better control
        .setSendLiveMetrics(true) // so we can monitor the app in real-time
        .start()
      this.client = AI.defaultClient
      console.debug('Successfully started ApplicationInsights client')
    }
  }

  // for some reason, this doesn't show up in ApplicationInsights (there should be an `Exception` event type for this)
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
        },
        severity: SeverityLevel.Error
      })

    }

    if (errors.length > 0) {
      this.client.flush()
    }
  }

  public trackTrace (type: 'info' | 'warning' | 'error', message: string) {
    if (this.client == null) {
      return
    }

    // for now, keep the Application Insights organised by only sending important messages.
    // everything else can be read manually from the log file if required.
    let severity: SeverityLevel
    if (type === 'info') {
      return
    } else if (type === 'warning') {
      severity = SeverityLevel.Warning
    } else if (type === 'error') {
      severity = SeverityLevel.Error
    } else {
      assertUnreachable(type)
    }

    this.client.trackTrace({ message, severity })
  }
}
