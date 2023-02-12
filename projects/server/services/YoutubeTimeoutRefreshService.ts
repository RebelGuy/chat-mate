import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
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

  private timeoutTimerMap: Map<number, [NextInterval, number]> = new Map()

  constructor (deps: Deps) {
    super()

    this.timerHelpers = deps.resolve('timerHelpers')
    this.dateTime = deps.resolve('dateTimeHelpers')
  }

  /** Periodically calls the onRefresh method such that the timeout on Youtube expires at the provided time.
   * `startImmediately` should be set to true when initialising from a fresh start, and set to false when adding a new timeout punishment. */
  public async startTrackingTimeout (timeoutRankId: number, expirationTime: Date, startImmediately: boolean, onRefresh: () => Promise<void>) {
    this.stopTrackingTimeout(timeoutRankId)

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
      callback: () => this.onElapsed(timeoutRankId, expirationTime, onRefresh)
    }

    let timerId: number
    if (startImmediately) {
      timerId = await this.timerHelpers.createRepeatingTimer(options, true)
    } else {
      timerId = this.timerHelpers.createRepeatingTimer(options, false)
    }

    this.timeoutTimerMap.set(timeoutRankId, [initialInterval, timerId])
  }

  /** Should be called when the punishment has been revoked. It will take up to 5 minutes for the revokation to come into effect on Youtube. */
  public stopTrackingTimeout (timeoutRankId: number) {
    if (this.timeoutTimerMap.has(timeoutRankId)) {
      const timerId = this.timeoutTimerMap.get(timeoutRankId)![1]
      this.timerHelpers.disposeSingle(timerId)
      this.timeoutTimerMap.delete(timeoutRankId)
    }
  }

  private async onElapsed (timeoutRankId: number, expirationTime: Date, onRefresh: () => Promise<void>): Promise<number> {
    const [prevInterval, timerId] = this.timeoutTimerMap.get(timeoutRankId)!

    if (prevInterval.type === 'noMore') {
      this.stopTrackingTimeout(timeoutRankId)
      return 0

    } else {
      await onRefresh()
      const nextInterval = this.calculateNextInterval(expirationTime, prevInterval)
      this.timeoutTimerMap.set(timeoutRankId, [nextInterval, timerId])
      if (nextInterval.type === 'noMore') {
        this.stopTrackingTimeout(timeoutRankId)
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
