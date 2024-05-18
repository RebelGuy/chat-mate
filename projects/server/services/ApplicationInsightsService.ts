import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import * as AI from 'applicationinsights'
import { SeverityLevel } from 'applicationinsights/out/Declarations/Contracts'

type Deps = Dependencies<{
  appInsightsClient: AI.TelemetryClient | null
}>

export default class ApplicationInsightsService extends ContextClass {
  private readonly appInsightsClient: AI.TelemetryClient | null

  constructor (deps: Deps) {
    super()

    this.appInsightsClient = deps.resolve('appInsightsClient')
  }

  // for some reason, this doesn't show up in ApplicationInsights (there should be an `Exception` event type for this)
  public trackException (args: any[]) {
    if (this.appInsightsClient == null) {
      return
    }

    let errors: Error[] = args.filter(arg => arg instanceof Error)
    let data = args.filter(arg => !(arg instanceof Error))

    for (const error of errors) {
      this.appInsightsClient.trackException({
        exception: error,
        properties: {
          additionalData: data
        },
        severity: SeverityLevel.Error
      })

    }

    if (errors.length > 0) {
      this.appInsightsClient.flush()
    }
  }

  public trackTrace (type: 'info' | 'warning' | 'error', message: string) {
    if (this.appInsightsClient == null) {
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

    this.appInsightsClient.trackTrace({ message, severity })
  }
}
