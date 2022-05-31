import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import { clamp } from '@rebel/server/util/math'

// Clicking on the "timeout" option in a chat context menu times out the user by 5 minutes. This cannot be
// changed without access to the Youtube API, so we have to manually refresh this timeout.
export const YOUTUBE_TIMEOUT_DURATION = 5 * 60 * 1000
export const BUFFER = 5000

type Deps = Dependencies<{
  timerHelpers: TimerHelpers
}>

export default class YoutubeTimeoutRefreshService extends ContextClass {
  private readonly timerHelpers: TimerHelpers

  private punishmentTimerMap: Map<number, number> = new Map()

  constructor (deps: Deps) {
    super()

    this.timerHelpers = deps.resolve('timerHelpers')
  }

  /** Periodically calls the onRefresh method such that the timeout on Youtube expires at the provided time.
   * `startImmediately` should be set to true when initialising from a fresh start, and set to false when adding a new timeout punishment. */
  public async startTrackingTimeout (punishmentId: number, expirationTime: Date, startImmediately: boolean, onRefresh: () => Promise<void>) {
    this.stopTrackingTimeout(punishmentId)

    const initialInterval = calculateNextInterval(expirationTime)
    if (initialInterval == null) {
      if (startImmediately) {
        // don't need a timer - only a single refresh will do
        await onRefresh()
        return
      } else {
        return
      }
    }

    const options: TimerOptions = {
      behaviour: 'dynamicEnd',
      initialInterval: initialInterval,
      callback: () => this.onElapsed(punishmentId, expirationTime, onRefresh)
    }

    let timerId: number
    if (startImmediately) {
      timerId = await this.timerHelpers.createRepeatingTimer(options, true)
    } else {
      timerId = this.timerHelpers.createRepeatingTimer(options, false)
    }

    this.punishmentTimerMap.set(punishmentId, timerId)
  }

  /** Should be called when the punishment has been revoked. It will take up to 5 minutes for the revokation to come into effect on Youtube. */
  public stopTrackingTimeout (punishmentId: number) {
    if (this.punishmentTimerMap.has(punishmentId)) {
      this.timerHelpers.disposeSingle(this.punishmentTimerMap.get(punishmentId)!)
    }
  }

  private async onElapsed (punishmentId: number, expirationTime: Date, onRefresh: () => Promise<void>): Promise<any> {
    const nextInterval = calculateNextInterval(expirationTime)
    if (nextInterval == null) {      
      // stop
      const timerId = this.punishmentTimerMap.get(punishmentId)!
      this.punishmentTimerMap.delete(punishmentId)
      this.timerHelpers.disposeSingle(timerId)
    } else {
      // refresh
      await onRefresh()
      return nextInterval
    }
  }
}

export function calculateNextInterval (expirationTime: Date): number | null {
  const now = new Date().getTime()
  const expiration = expirationTime.getTime()
  const remainder = expiration - now

  const maxInterval = YOUTUBE_TIMEOUT_DURATION - BUFFER

  if (remainder < maxInterval) {
    // this is the last interval
    return null
  } else if (remainder > maxInterval * 2) {
    return maxInterval
  } else {
    // remainder is between maxInterval and 2*maxInterval
    // since the timeout always lasts for the same period, we have to make sure we set up the refreshes so the timeout expires at the desired time.
    // we can fine-tune the expiration time only if we are more than 1 period from expiration (now is a good time).
    // we return a smaller-than-maximum interval so that, after the next refresh, we can just naturally let the timeout expire.
    return clamp(remainder - YOUTUBE_TIMEOUT_DURATION, 0, maxInterval)
  }
}
