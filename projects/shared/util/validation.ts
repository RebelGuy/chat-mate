export function isOneOf<V extends any[]> (x: any, ...allowedValues: V): x is V[number] {
  return allowedValues.find(v => v === x) != null
}
