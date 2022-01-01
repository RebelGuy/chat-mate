import { MockProxy } from 'jest-mock-extended'

export function single<T> (array: ArrayLike<T>): T {
  if (array.length === 1) {
    return array[0]
  } else {
    throw new Error(`Expected 1 element in the array but found ${array.length}`)
  }
}

type Class = new (...args: any[]) => any

type ClassMember<C extends Class> = Exclude<keyof InstanceType<C> & string, 'name'>

export function nameof<C extends Class, MemberName extends ClassMember<C>> (obj: C, memberName: MemberName): string {
  return `${obj.name}.${memberName}`
}


// stolen from jest
type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K
}[keyof T] & string

// custom getter mock from https://github.com/marchaos/jest-mock-extended/issues/4#issuecomment-587446452
export function mockGetter<T, GetterName extends NonFunctionPropertyNames<T>> (obj: MockProxy<T>, getterName: GetterName) {
  const mockedGetter = jest.fn() as jest.Mock<T[GetterName], []>
  Object.defineProperty(obj, getterName, {
    get: mockedGetter
  })

  return mockedGetter
}

// gets the jes.fn().mock object of the mocked getter
export function getMockGetterMock<T, GetterName extends NonFunctionPropertyNames<T>> (obj: MockProxy<T>, getterName: GetterName) {
  const mockedGetter = Object.getOwnPropertyDescriptor(obj, getterName)!.get as jest.Mock<T[GetterName], []>
  return mockedGetter.mock
}

export function promised<T> (value: T): Promise<T> {
  return new Promise(res => res(value))
}
