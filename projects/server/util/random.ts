import { sum } from '@rebel/server/util/math'

export function chooseRandom<T> (...args: T[]): T {
  return chooseWeightedRandom(...args.map(a => [a, 1] as [T, number]))
}

export function chooseWeightedRandom<T> (...args: [T, number][]): T {
  const totalWeights = sum(args.map(a => a[1]))

  const r = Math.random()
  let cumWeight = 0
  for (const [value, weight] of args) {
    cumWeight += weight / totalWeights
    if (r < cumWeight) {
      return value
    }
  }

  return args.at(-1)![0]
}

export function pickRandom<T> (args: T[]): T {
  return args[Math.floor(Math.random() * args.length)]
}

/** From: inclusive. To: exclusive. */
export function randomInt (from: number, to: number) {
  return Math.floor(Math.random() * (to - from)) + from
}

export function randomString (length: number) {
  const options = 'abcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += options.at(randomInt(0, options.length))
  }
  return result
}