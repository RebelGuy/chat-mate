import { ChatMateError } from '@rebel/shared/util/error'
import * as text from '@rebel/shared/util/text'

describe(text.getLiveId, () => {
  const testId = 'VTriRgpNd-s'

  test('raw liveId', () => expect(text.getLiveId(testId)).toBe(testId))
  test('public livestream link short', () => expect(text.getLiveId('https://youtu.be/VTriRgpNd-s')).toBe(testId))
  test('public livestream link full', () => expect(text.getLiveId('https://www.youtube.com/watch?v=VTriRgpNd-s')).toBe(testId))
  test('studio livestream link', () => expect(text.getLiveId('https://studio.youtube.com/video/VTriRgpNd-s/livestreaming')).toBe(testId))
  test('invalid throws error', () => expect(() => text.getLiveId('TriRgpNd-s')).toThrowError(ChatMateError))
})

describe(text.toConstCase, () => {
  test('camel case input', () => expect(text.toConstCase('helloWorld')).toBe('HELLO_WORLD'))
  test('pascal case input', () => expect(text.toConstCase('HelloWorld')).toBe('HELLO_WORLD'))
  test('const case input', () => expect(text.toConstCase('HELLO_WORLD')).toBe('HELLO_WORLD'))
  test('interface case input', () => expect(text.toConstCase('IHelloWorld')).toBe('IHELLO_WORLD'))
  test('multiple words throws error', () => expect(() => text.toConstCase('hello world')).toThrowError(ChatMateError))
})

describe(text.toCamelCase, () => {
  test('camel case input', () => expect(text.toCamelCase('helloWorld')).toBe('helloWorld'))
  test('pascal case input', () => expect(text.toCamelCase('HelloWorld')).toBe('helloWorld'))
  test('const case input', () => expect(text.toCamelCase('HELLO_WORLD')).toBe('helloWorld'))
  test('multiple words throws error', () => expect(() => text.toCamelCase('hello world')).toThrowError(ChatMateError))
})

describe(text.toParamCase, () => {
  test('multiple words input', () => expect(text.toParamCase('hello world')).toBe('hello_world'))
  test('camel case input', () => expect(text.toParamCase('helloWorld')).toBe('hello_world'))
  test('single word input', () => expect(text.toParamCase('helloworld')).toBe('helloworld'))
  test('param case input', () => expect(text.toParamCase('hello_world')).toBe('hello_world'))
})
