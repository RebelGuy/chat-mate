import * as objects from '@rebel/shared/util/objects'
import { NO_OP } from '@rebel/shared/util/typescript'
import { Primitive } from '@rebel/shared/types'
import { ChatMateError } from '@rebel/shared/util/error'

describe(objects.transformPrimitiveValues, () => {
  const EXPECT_UNUSED = (key: any, value: any) => { throw new ChatMateError(`Did not expect this function to get called for ${key}: ${value}.` )}

  test('Returns empty object if an empty object is passed in', () => {
    const input = {}

    const result = objects.transformPrimitiveValues(input, EXPECT_UNUSED)

    expect(result).toEqual({})
  })

  test('Throws for functional values', () => {
    const input = { a: NO_OP }

    expect(() => objects.transformPrimitiveValues(input, EXPECT_UNUSED)).toThrow('() => { } could not be cloned.')
  })

  test('Replaces shallow primitives', () => {
    const input = { a: null, b: undefined, c: true, d: 5, e: 'test' }
    const transformer = (key: any, value: Primitive | undefined) => {
      if (key === 'a' && value === null) {
        return 123
      } else if (key === 'b' && value === undefined) {
        return { bInner: 123 }
      } else if (key === 'c' && typeof value === 'boolean') {
        return false
      } else if (key === 'd' && typeof value === 'number') {
        return '123'
      } else if (key === 'e' && typeof value === 'string') {
        return ''
      } else {
        throw new ChatMateError('Unexpected object type')
      }
    }

    const result = objects.transformPrimitiveValues(input, transformer)

    expect(result).toEqual({ a: 123, b: { bInner: 123 }, c: false, d: '123', e: '' })
  })

  test('Replaces deep primitives', () => {
    const input = { a: null, x: { b: undefined, y: { c: true, d: 5, z: { e: 'test' }}}}
    const transformer = (key: any, value: Primitive | undefined) => {
      if (key === 'a' && value === null) {
        return 123
      } else if (key === 'b' && value === undefined) {
        return { bInner: 123 }
      } else if (key === 'c' && typeof value === 'boolean') {
        return false
      } else if (key === 'd' && typeof value === 'number') {
        return '123'
      } else if (key === 'e' && typeof value === 'string') {
        return ''
      } else {
        throw new ChatMateError('Unexpected object type')
      }
    }

    const result = objects.transformPrimitiveValues(input, transformer)

    expect(result).toEqual({ a: 123, x: { b: { bInner: 123 }, y: { c: false, d: '123', z: { e: '' }}}})
  })

  test('Processes arrays', () => {
    const input = [{ a: 1 }, { b: [{ c: 'x' }, { d: 'y' }]}]
    const transformer = (key: any, value: Primitive | undefined) => {
      if (key === 'a' && value === 1) {
        return 3
      } else if (key === 'c' && value === 'x') {
        return 4
      } else if (key === 'd' && value === 'y') {
        return 5
      } else {
        throw new ChatMateError('Unexpected object type')
      }
    }

    const result = objects.transformPrimitiveValues(input, transformer)

    expect(result).toEqual([{ a: 3 }, { b: [{ c: 4 }, { d: 5 }]}])
  })
})
