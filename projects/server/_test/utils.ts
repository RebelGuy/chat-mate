import { DeepPartial } from '@rebel/server/types'
import { Matcher, MatcherCreator, MockProxy } from 'jest-mock-extended'

type Class = new (...args: any[]) => any

type ClassMember<C extends Class> = Exclude<keyof InstanceType<C> & string, 'name'>

/** Typed name of a class or function. */
export function nameof<C extends Class, MemberName extends ClassMember<C>> (obj: C, memberName: MemberName): string
export function nameof<F extends (...args: any[]) => any> (obj: F): string
export function nameof<O extends Class | ((...args: any[]) => any)> (obj: O, memberName?: string): string {
  if (memberName != null) {
    return `${obj.name}.${memberName}`
  } else {
    return obj.name
  }
}

// stolen from jest
type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K
}[keyof T] & string

// custom getter mock from https://github.com/marchaos/jest-mock-extended/issues/4#issuecomment-587446452
export function mockGetter<T, GetterName extends NonFunctionPropertyNames<T>> (obj: MockProxy<T>, getterName: GetterName) {
  const mockedGetter = jest.fn() as jest.Mock<T[GetterName], []>
  Object.defineProperty(obj, getterName, {
    get: mockedGetter,
    configurable: true // allow this to be overwritten if it already exists
  })

  return mockedGetter
}

// gets the jes.fn() object of the mocked getter
export function getGetterMock<T, GetterName extends NonFunctionPropertyNames<T>> (obj: MockProxy<T>, getterName: GetterName) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const mockedGetter = Object.getOwnPropertyDescriptor(obj, getterName)!.get as jest.Mock<T[GetterName], []>
  return mockedGetter
}

export function promised<T> (value: T): Promise<T> {
  return new Promise(res => res(value))
}

export function deleteProps<T, Prop extends keyof T> (obj: T, ...props: Prop[]): Omit<T, Prop> {
  const result = { ...obj }
  for (const prop of props) {
    delete result[prop]
  }
  return result
}

export function expectStrictIncreasing (...values: number[]) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i - 1]).toBeLessThan(values[i])
  }
}

/** Shorthand for casting a partial type to its full version, such as `{} as Partial<T> as T`. */
export function cast<T> (data: DeepPartial<T>): T
export function cast<T extends Array<any>> (data: DeepPartial<(T extends Array<infer A> ? A : never)>[]): T // the array's underlying type should be made partial, not the array type itself
export function cast<T> (data: DeepPartial<T>): T {
  return data as T
}

export function expectObject<T> (data: DeepPartial<T>): T {
  if (Array.isArray(data)) {
    // expect.objectContaining doesn't seem to work properly with an array, so instead apply expect.objectContaining on the array items
    return data.map(x => expectObject(x)) as any
  } else {
    return expect.objectContaining(data)
  }
}

export function expectArray<T> (data: Partial<T>[]): T[] {
  return expect.arrayContaining(data)
}

/** Matches any date. */
export function anyDate (): Matcher<Date> {
  return new Matcher<Date>(
    (actualDate) => actualDate instanceof Date,
    'Matches any date.'
  )
}
