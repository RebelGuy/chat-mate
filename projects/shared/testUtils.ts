import { DeepPartial, GenericObject, Primitive, Singular } from '@rebel/shared/types'
import { isNullable, isPrimitive } from '@rebel/shared/util/typescript'
import { Matcher, MatcherCreator, MockProxy } from 'jest-mock-extended'

type Class = new (...args: any[]) => any

type ClassMember<C extends Class> = Exclude<keyof InstanceType<C> & string, 'name'>

type AnyValue = object | Primitive | null | undefined

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
export function cast<T extends any[]> (data: DeepPartial<Singular<T>>[]): T // the array's underlying type should be made partial, not the array type itself
export function cast<T> (data: DeepPartial<T>): T {
  return data as T
}

// the overload is just for convenience so that we don't need to specify the generic type but instead just pass in a value that has the generic type
// this will NOT work if providing partial items to a nested array, only if `T` itself is of type array. to get around this, call `expectObject()` on the nested array as well, or use `expectObjectDeep()`.
export function expectObject<T extends AnyValue> (fullObj: T, partialObj: DeepPartial<T>): T
export function expectObject<T extends AnyValue> (data: DeepPartial<T>): T
export function expectObject<T extends AnyValue> (fullOrPartialObject: T | DeepPartial<T>, partialObj?: DeepPartial<T>): T {
  if (partialObj == null) {
    partialObj = fullOrPartialObject as DeepPartial<T> // I don't understand why casting is required lol
  }

  if (Array.isArray(partialObj)) {
    // expect.objectContaining doesn't seem to work properly with an array, so instead apply expect.objectContaining on the array items
    return partialObj.map(x => expectObject(x)) as any
  } else if (isPrimitive(partialObj) || isNullable(partialObj)) {
    return partialObj as T
  } else {
    return expect.objectContaining(partialObj)
  }
}

// the overload is just for convenience so that we don't need to specify the generic type but instead just pass in a value that has the generic type.
// deep nesting of partials prevents you from using `expect.*` matchers. if this is required, use the shallow `expectObject()` method instead.
export function expectObjectDeep<T extends AnyValue> (fullObj: T, partialObj: DeepPartial<T>): T
export function expectObjectDeep<T extends AnyValue> (data: DeepPartial<T>): T
export function expectObjectDeep<T extends AnyValue> (fullOrPartialObject: T | DeepPartial<T>, partialObj?: DeepPartial<T>): T {
  if (partialObj == null) {
    partialObj = fullOrPartialObject as DeepPartial<T>
  }

  if (Array.isArray(partialObj)) {
    // expect.objectContaining doesn't seem to work properly with an array, so instead apply expect.objectContaining on the array items
    return partialObj.map(x => expectObjectDeep(x)) as any
  } else if (isPrimitive(partialObj) || isNullable(partialObj)) {
    return partialObj as T
  } else {
    let deepExpect: GenericObject = {}
    for (const key of Object.keys(partialObj)) {
      const value = (partialObj as any)[key]
      if (!isPrimitive(value) && !isNullable(value) && typeof value === 'object') {
        deepExpect[key] = expectObjectDeep(value)
      } else {
        deepExpect[key] = value
      }
    }
    return expect.objectContaining(deepExpect)
  }
}

export function expectArray<T extends AnyValue> (fullObj: T[], partialObj: DeepPartial<T>[]): T[]
export function expectArray<T extends AnyValue[]> (fullObj: T, partialObj: DeepPartial<Singular<T>>[]): T
export function expectArray<T extends AnyValue> (data: DeepPartial<T>[]): T[]
export function expectArray<T extends AnyValue> (fullOrPartialObject: T[] | DeepPartial<T>[], partialObj?: DeepPartial<T>[]): T[] {
  if (partialObj == null) {
    partialObj = fullOrPartialObject as DeepPartial<T>[]
  }

  return expect.arrayContaining(partialObj)
}

/** Matches any date. */
export function anyDate (): Matcher<Date> {
  return new Matcher<Date>(
    (actualDate) => actualDate instanceof Date,
    'Matches any date.'
  )
}
