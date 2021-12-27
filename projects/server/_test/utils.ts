export function single<T> (array: ArrayLike<T>): T {
  if (array.length === 1) {
    return array[0]
  } else {
    throw new Error(`Expected 1 element in the array but found ${array.length}`)
  }
}

export function nameof<T extends new (...args: any[]) => any, Name extends keyof InstanceType<T> & string> (obj: T, name: Name): string {
  return `${obj.name}.${name}`
}
