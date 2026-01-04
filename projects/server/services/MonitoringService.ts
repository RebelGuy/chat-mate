import ContextClass from '@rebel/shared/context/ContextClass'
import newrelic from 'newrelic'

export default class MonitoringService extends ContextClass {
  public trackException (args: any[]) {
    let errors: Error[] = args.filter(arg => arg instanceof Error)
    let data: string
    try {
      data = JSON.stringify(args.filter(arg => !(arg instanceof Error)))
    } catch (e: any) {
      data = `<Unable to stringify data: ${e.message}>`
    }

    for (const error of errors) {
      newrelic.noticeError(error, { data: data })
    }
  }

  // todo: add methods for segments (should be wrapped around long-lasting or external calls, e.g. db requests, Youtube API requests, etc)
  // todo: add methods to add attributes to the current transaction (e.g. IP, user name, streamer ID)
}
