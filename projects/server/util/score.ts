import { NumRange, clamp } from '@rebel/server/util/math'

// Calculates the score given a list of ordered items. The qualifier function is
// called for each item, and the running score will update according to the `updater` method.
export function calculateWalkingScore<T, Min extends number, Max extends number> (
  items: T[],
  initialScore: number,
  qualifier: (current: T, prev: T | null, next: T | null) => boolean,
  updater: (currentScore: number, qualified: boolean) => number,
  min: Min,
  max: Max
): NumRange<Min, Max> {
  let score = clamp(initialScore, min, max)

  for (let i = 0; i < items.length; i++) {
    const prev = i === 0 ? null : items[i - 1]
    const current = items[i]
    const next = i === items.length - 1 ? null : items[i + 1]
    const qualified = qualifier(current, prev, next)
    score = clamp(updater(score, qualified), min, max)
  }

  return score
}
