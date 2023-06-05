import { Primitive } from '@rebel/shared/types'
import { isPrimitive } from '@rebel/shared/util/typescript'

export function keysOf<TObj extends Record<any, any>> (obj: TObj): (keyof TObj)[] {
  return Object.keys(obj)
}

/** Visits every primitive value and replaces it with the output of the `transformer`. Throws if any functional values are encountered.
 * Arrays are supported, where keys will be set to '1', '2', ... */
export function transformPrimitiveValues (obj: Record<any, any>, transformer: (key: any, value: Primitive | null | undefined) => any) {
  const copiedObject = structuredClone(obj)
  return transformPrimitiveValuesInPlace(copiedObject, transformer)
}

function transformPrimitiveValuesInPlace (obj: Record<any, any>, transformer: (key: any, value: Primitive | null | undefined) => any) {
  for (let key of Object.keys(obj)) {
    let value = obj[key]
    if (value == null || isPrimitive(value)) {
      obj[key] = transformer(key, value)
    } else if (typeof value === 'object') {
      // works for arrays, since Object.keys() returns ['1', '2', ...]
      obj[key] = transformPrimitiveValuesInPlace(value, transformer)
    } else {
      // everything else is left as-is
    }
  }

  return obj
}
