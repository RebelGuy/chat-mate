import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'

// Clicking on the "timeout" option in a chat context menu times out the user by 5 minutes. This cannot be
// changed without access to the Youtube API, so we have to manually refresh this timeout.
export const YOUTUBE_TIMEOUT_DURATION = 5 * 60 * 1000

// we have to ensure continuity between intents of interval calculations.
// for example, if we know we should only refresh once more, then that should be
// honoured in subsequent calculations. this solves the issue of applying spam timeouts
// in oreer to get as close to thefinal timeout time as possible.
export type NextInterval = {
  type: 'noMore'
} | {
  type: 'oneMore'
  interval: number
} | {
  type: 'manyMore'
  interval: number
}

type Deps = Dependencies<{
  timerHelpers: TimerHelpers
  dateTimeHelpers: DateTimeHelpers
}>

export default class YoutubeTimeoutRefreshService extends ContextClass {
  readonly name = YoutubeTimeoutRefreshService.name

  private readonly timerHelpers: TimerHelpers
  private readonly dateTime: DateTimeHelpers

  private punishmentTimerMap: Map<number, [NextInterval, number]> = new Map()

  constructor (deps: Deps) {
    super()

    this.timerHelpers = deps.resolve('timerHelpers')
    this.dateTime = deps.resolve('dateTimeHelpers')
  }

  /** Periodically calls the onRefresh method such that the timeout on Youtube expires at the provided time.
   * `startImmediately` should be set to true when initialising from a fresh start, and set to false when adding a new timeout punishment. */
  public async startTrackingTimeout (punishmentId: number, expirationTime: Date, startImmediately: boolean, onRefresh: () => Promise<void>) {
    this.stopTrackingTimeout(punishmentId)

    const initialInterval = this.calculateNextInterval(expirationTime, null)

    if (startImmediately) {
      await onRefresh()
    }

    if (initialInterval.type === 'noMore') {
      return
    }

    const options: TimerOptions = {
      behaviour: 'dynamicEnd',
      initialInterval: initialInterval.interval,
      callback: () => this.onElapsed(punishmentId, expirationTime, onRefresh)
    }

    let timerId: number
    if (startImmediately) {
      timerId = await this.timerHelpers.createRepeatingTimer(options, true)
    } else {
      timerId = this.timerHelpers.createRepeatingTimer(options, false)
    }

    this.punishmentTimerMap.set(punishmentId, [initialInterval, timerId])
  }

  /** Should be called when the punishment has been revoked. It will take up to 5 minutes for the revokation to come into effect on Youtube. */
  public stopTrackingTimeout (punishmentId: number) {
    if (this.punishmentTimerMap.has(punishmentId)) {
      const timerId = this.punishmentTimerMap.get(punishmentId)![1]
      this.timerHelpers.disposeSingle(timerId)
      this.punishmentTimerMap.delete(punishmentId)
    }
  }

  private async onElapsed (punishmentId: number, expirationTime: Date, onRefresh: () => Promise<void>): Promise<number> {
    const [prevInterval, timerId] = this.punishmentTimerMap.get(punishmentId)!

    if (prevInterval.type === 'noMore') {
      this.stopTrackingTimeout(punishmentId)
      return 0

    } else {
      await onRefresh()
      const nextInterval = this.calculateNextInterval(expirationTime, prevInterval)
      this.punishmentTimerMap.set(punishmentId, [nextInterval, timerId])
      if (nextInterval.type === 'noMore') {
        this.stopTrackingTimeout(punishmentId)
        return 0
      } else {
        return nextInterval.interval
      }
    }
  }

  /** Providing lastInterval aids in maintaining a continuation of intent. */
  private calculateNextInterval (expirationTime: Date, prevInterval: NextInterval | null): NextInterval {
    const remainder = expirationTime.getTime() - this.dateTime.ts()
    const lastType = prevInterval?.type

    if (remainder <= YOUTUBE_TIMEOUT_DURATION && (lastType == null || lastType === 'noMore' || lastType === 'oneMore')) {
      return { type: 'noMore' }
    } else if (remainder > YOUTUBE_TIMEOUT_DURATION * 2) {
      return { type: 'manyMore', interval: YOUTUBE_TIMEOUT_DURATION }
    } else {
      // remainder is between YOUTUBE_TIMEOUT_DURATION and 2 * YOUTUBE_TIMEOUT_DURATION
      // since the timeout always lasts for the same period, we have to make sure we set up the refreshes so the timeout expires at the desired time.
      // we can fine-tune the expiration time only if we are more than 1 period from expiration (now is a good time).
      // we return a smaller-than-maximum interval so that, after the next refresh, we can just naturally let the timeout expire.
      return { type: 'oneMore', interval: remainder - YOUTUBE_TIMEOUT_DURATION }
    }
  }
}
