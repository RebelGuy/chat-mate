export type GenericObject = Record<string | number | symbol, any>

export type Primitive = string | number | boolean

export type EmptyObject = Record<string, never>

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

/** Returns the union of property names that belong to a primitive value. */
export type PrimitiveKeys<T> = ({
  [P in keyof T]: T[P] extends Primitive ? P : never
})[keyof T]

export type NoNulls<T> = {
  [P in keyof T]: Exclude<T[P], null>
}

export type Nullify<T> = {
  [P in keyof T]: T[P] | null
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] extends Array<infer A> ? DeepPartial<A>[] : T[P]
}

export declare type MakeOptional<T extends object, Keys extends keyof T> = {
  [K in Keys]?: T[K]
} & {
  [K in Exclude<keyof T, Keys>]: T[K]
}

export type ObjectComparator<T> = {
  [key in keyof T]: ValueComparator<T[key]>
}

export type ValueComparator<V> = null | 'default' | ((a: V, b: V) => boolean)

export type Branded<T, BrandingEnum> = T & { brand: BrandingEnum }

type NumberOnlyKeys<T> = {
  [K in keyof T]: number extends T[K] ? K : never
}[keyof T]

export type NumberOnly<T extends GenericObject> = Pick<T, NumberOnlyKeys<T>>

export type Singular<T> = T extends Array<infer K> ? K : never
