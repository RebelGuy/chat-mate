export function keysOf<TObj extends Record<any, any>> (obj: TObj): (keyof TObj)[] {
  return Object.keys(obj)
}
