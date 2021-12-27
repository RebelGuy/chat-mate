export function single<T> (array: ArrayLike<T>): T {
  if (array.length === 1) {
    return array[0]
  } else {
    throw new Error(`Expected 1 element in the array but found ${array.length}`)
  }
}