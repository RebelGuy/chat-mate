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

describe(text.parseDataUrl, () => {
  test('Throws if malformed dataURL', () => {
    expect(() => text.parseDataUrl('abc')).toThrowError(ChatMateError)
    expect(() => text.parseDataUrl('data:abc')).toThrowError(ChatMateError)
    expect(() => text.parseDataUrl('data:image/png,abc')).toThrowError(ChatMateError)
    expect(() => text.parseDataUrl('data:image;base64,abc')).toThrowError(ChatMateError)
    expect(() => text.parseDataUrl('data:image;xyz,abc')).toThrowError(ChatMateError)
  })

  test('Correctly extracts file type and data', () => {
    const result = text.parseDataUrl('data:image/png;base64,abc')

    expect(result).toEqual<typeof result>({
      fileType: 'image',
      fileSubType: 'png',
      data: 'abc'
    })
  })
})

describe(text.getFileExtension, () => {
  test('Extracts the file extension from a http url with query params', () => {
    const extension = text.getFileExtension('https://syd1.digitaloceanspaces.com/chat-mate/local/custom-emoji/2/25/9.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO002MFHYM8KHHDK667J%2F20240407%2Fsyd1%2Fs3%2Faws4_request&X-Amz-Date=20240407T103949Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=ba36c2209ba4908dc3f531b8c0f7e5997037de3dfdc8d25ba128d01b6dbae94c')

    expect(extension).toBe('png')
  })
})
