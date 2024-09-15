import ContextClass from '@rebel/shared/context/ContextClass'
import { formatDate } from '@rebel/shared/util/datetime'

export default class VisitorHelpers extends ContextClass {
  public getTimeString (date: Date): string {
    // the time string changes every 15 minutes - this allows us to count unique visitors in buckets of 15 minutes
    const minutes = date.getUTCMinutes() - date.getUTCMinutes() % 15
    return `${formatDate(date)} ${date.getUTCHours()}:${minutes}`
  }
}
