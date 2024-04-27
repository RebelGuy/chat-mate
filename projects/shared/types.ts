export type GenericObject = Record<string | number | symbol, any>

export type Primitive = string | number | boolean | null

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
type NullableToOptional_<T> = SafeOmit<T, NullableKeys<T>> & {
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

/** Returns T but with all `never` properties removed. */
export type NoNever<T extends GenericObject> = SafeOmit<T, { [K in keyof T]: T[K] extends never ? K : never }[keyof T]>

export type Nullify<T> = {
  [P in keyof T]: T[P] | null
}

export type DeepPartial<T> = T extends Primitive | null | undefined ? T : {
  [P in keyof T]?:
    T[P] extends (...args: any[]) => any ? T[P] :
    // if the object is null or undefined, the result is the partial object plus null or undefined, whichever applied
    T[P] extends GenericObject | null | undefined ? DeepPartial<Exclude<T[P], null | undefined>> | Extract<T[P], null | undefined> :
    T[P] extends Array<infer A> ? DeepPartial<A>[] :
    T[P]
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

// stolen from https://stackoverflow.com/a/50732491, I have no idea how this works
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

export type RecordValueType<T> = T extends Record<any, infer V> ? V : never

/** Extract from T those types that are assignable to U, ensuring that U is strictly a sub-type of T. */
export type SafeExtract<T, U extends T> = U extends Extract<T, U> ? U : never

/** Omit from T the provided keys. */
export type SafeOmit<T, K extends keyof T> = Omit<T, K>

export type SafeExclude<T, U extends T> = Exclude<T, U>
