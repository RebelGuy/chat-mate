import { Branded } from '@rebel/server/types'
import { List, isList } from 'immutable'

// hack: https://github.com/microsoft/TypeScript/issues/31752
// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
export const negativeInfinity = -1e999
// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
export const positiveInfinity = 1e999
export const eps = 1e-10 as const
export type NegativeInfinity = typeof negativeInfinity
export type PositiveInfinity = typeof positiveInfinity
export type Eps = typeof eps

// this way we cannot just assign clamped values with different min/max to each other
// type _RangeBrand<Min, Max> = { min?: Min, max?: Max }
export type NumRange<Min extends number, Max extends number> = GreaterThanOrEqual<Min> & LessThanOrEqual<Max>

type _GreaterThanBrand<Value> = { greaterThan?: Value }
export type GreaterThan<N extends number> = Branded<number, _GreaterThanBrand<N>>
export type GreaterThanOrEqual<N extends number> = N | GreaterThan<N>

type _LessThanBrand<Value> = { lessThan?: Value }
export type LessThan<N extends number> = Branded<number, _LessThanBrand<N>>
export type LessThanOrEqual<N extends number> = N | LessThan<N>

export function asLte<N extends number> (value: N): LessThanOrEqual<N>
export function asLte<N extends number, C extends number> (value: N, constraint: C): N & LessThanOrEqual<C>
export function asLte<N extends number, C extends number> (value: N, constraint?: C): N & LessThanOrEqual<C> {
  return assertConstraint(value <= (constraint ?? value), value, constraint ?? value, 'less than or equal to')
}

export function asLt<N extends number, C extends number> (value: N, constraint: C): N & LessThan<C> {
  return assertConstraint(value < constraint, value, constraint, 'less than')
}

export function asGte<N extends number> (value: N): GreaterThanOrEqual<N>
export function asGte<N extends number, C extends number> (value: N, constraint: C): N & GreaterThanOrEqual<C>
export function asGte<N extends number, C extends number> (value: N, constraint?: C): N & GreaterThanOrEqual<C> {
  return assertConstraint(value >= (constraint ?? value), value, constraint ?? value, 'greater than or equal to')
}

export function asGt<N extends number, C extends number> (value: N, constraint: C): N & GreaterThan<C> {
  return assertConstraint(value > constraint, value, constraint, 'greater than')
}

export function asRange<Min extends number, Max extends number> (value: number, min: Min, max: Max): NumRange<Min, Max> {
  asGte(value, min)
  asLte(value, max)
  return value as any
}

function assertConstraint (condition: boolean, value: number, constraint: number, constraintDescription: string): any {
  if (condition) {
    return value
  } else {
    throw new Error(`Expected value ${value} to be ${constraintDescription} ${constraint}`)
  }
}


// there is a proposal for inequality types which is exactly what we need.
// this way we will be able to implicitly cast 0.5 to NumRange<0, 1>
// or event NumRange<0, 1> to <NumRange<-1, 2>
// https://github.com/microsoft/TypeScript/issues/43505
// the overloads here help out typescript for getting a clean return type with no conditionals
export function clamp<Min extends number, Max extends number> (value: number, min: Min, max: Max): NumRange<Min, Max>
export function clamp<Min extends null, Max extends number> (value: number, min: Min, max: Max): NumRange<NegativeInfinity, Max>
export function clamp<Min extends number, Max extends null> (value: number, min: Min, max: Max): NumRange<Min, PositiveInfinity>
export function clamp<Min extends null, Max extends null> (value: number, min: Min, max: Max): NumRange<NegativeInfinity, PositiveInfinity>
export function clamp<Min extends number | null, Max extends number | null> (value: number, min: Min, max: Max)
  : NumRange<null extends Min ? NegativeInfinity : Exclude<Min, null>, null extends Max ? PositiveInfinity : Exclude<Max, null>> {
  const _min = min == null ? negativeInfinity : min
  const _max = max == null ? positiveInfinity : max

  // ugly `as` typing because typescript keeps casting to `number`
  return (value < _min ? _min : value > _max ? _max : value) as NumRange<null extends Min ? NegativeInfinity : Exclude<Min, null>, null extends Max ? PositiveInfinity : Exclude<Max, null>>
}

export function sum (numbers: number[] | List<number>) {
  if (isList(numbers)) {
    numbers = numbers.toArray()
  }

  return numbers.reduce((s, x) => s + x, 0)
}

// clamps and normalises the function across the given domain, i.e. return a value between 0 and 1 scaled according to the values at the domain boundaries.
// note that function values will be clipped by the rect [minX, fn(minX)], [maxX, fn(maxX)], so monotonic functions are preferred.
export function clampNormFn (fn: (x: number) => number, minX: number, maxX: number): (x: number) => number {
  const minY = fn(minX)
  const maxY = fn(maxX)

  return (x: number) => {
    if (maxY === minY) {
      // special case to avoid dividing by zero
      return 0.5
    }

    let y: number
    if (x < minX) {
      y = minY
    } else if (x > maxX) {
      y = maxY
    } else {
      y = fn(x)
    }

    const normY = (y - minY) / (maxY - minY)
    return normY
  }
}

export type Norm = NumRange<0, 1>

export function clampNorm (value: number, min: number, max: number): Norm
export function clampNorm (value: number, min: number, max: number, centre: number): Norm
export function clampNorm (value: number, min: number, max: number, centre?: number): Norm {
  if (centre === undefined) {
    centre = (max - min) / 2
  } else if (centre < min || centre > max) {
    throw new Error('Centre must lie between min and max')
  }

  if (min === max) {
    return 0.5 as Norm
  }

  let returnValue: number
  if (value <= min) {
    returnValue = 0
  } else if (value < centre) {
    returnValue = (value - min) / (centre - min) / 2
  } else if (value >= max) {
    returnValue = 1
  } else if (value > centre) {
    returnValue = 0.5 + (value - centre) / (max - centre) / 2
  } else {
    returnValue = 0.5
  }
  return returnValue as Norm
}

export function avg (...values: number[]): number | null {
  if (values.length === 0) {
    return null
  }

  return sum(values) / values.length
}

export function scaleNorm<Min extends number, Max extends number> (normValue: Norm, min: Min, max: Max): NumRange<Min, Max> {
  return normValue * (max - min) + min as NumRange<Min, Max>
}
