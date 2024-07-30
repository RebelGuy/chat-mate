import ContextClass from '@rebel/shared/context/ContextClass'

// used for testing

export default class DateTimeHelpers extends ContextClass {
  public now (): Date {
    return new Date()
  }

  public ts (): number {
    // this method helps us from accidentally calling `getDate()`
    return this.now().getTime()
  }

  public getStartOfToday () {
    let now = this.now()
    now.setUTCHours(0, 0, 0, 0)
    return now.getTime()
  }
}
