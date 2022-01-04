import { PositiveInfinity } from '@rebel/server/util/math'

export type GenericObject = { [key: string]: any };

// to ensure that the type definitions across different consumers are synced, any changes
// to the api response schema should be accompanied by a bump of the schema version -
// this way the consumers can easily detect potential bugs.
export type ApiSchema<Schema extends number, T> = T & { schema: Schema }

// from https://stackoverflow.com/questions/50490773/why-doesnt-typescript-undefined-type-behave-same-as-optional
// gets the keys of T that are optional
export type OptionalKeys<T> = ({
  // for some reason the ordering has to be this way
  [V in keyof T]-?: undefined extends T[V] ? V : never
})[keyof T] // gets all the keys, automatically discarding those of type `never`

export type Optionals<T> = Pick<T, OptionalKeys<T>>

export type NullableKeys<T> = ({
  [V in keyof T]: null extends T[V] ? V : never
})[keyof T]

// this intermediate step results in the union of objects of non-nullable and nullable properties,
// but we want a single object.
type NullableToOptional_<T> = Omit<T, NullableKeys<T>> & {
  [key in NullableKeys<T>]?: T[key]
}

// converts { a: b, c: d | null } to { a: b, c?: d | null }
export type NullableToOptional<T> = {
  [key in keyof NullableToOptional_<T>]: NullableToOptional_<T>[key]
}

// converts { foo?: bar } to { foo: bar | undefined }
export type MakeRequired<T> = {
  [P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : (T[P] | undefined);
}

export type NoNulls<T> = {
  [P in keyof T]: Exclude<T[P], null>
}

export type ObjectComparator<T> = {
  [key in keyof T]: ValueComparator<T[key]>
}

export type ValueComparator<V> = null | 'default' | ((a: V, b: V) => boolean)

export type Branded<T, BrandingEnum> = T & { brand: BrandingEnum }
