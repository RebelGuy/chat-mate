import { ArrayValidator, Validator, validateObject } from '@rebel/server/controllers/schema'
import { single } from '@rebel/shared/util/arrays'

describe(validateObject, () => {
  test('Validates a flat object with optionals and nullables and correct input', () => {
    const result = validateObject({
      a: { type: 'string' },
      b: { type: 'number' },
      c: { type: 'boolean' },
      d: { type: 'string', nullable: true },
      e: { type: 'number', optional: true },
      f: { type: 'boolean', optional: true, nullable: true },
      g: { type: 'string', optional: true, nullable: true }
    }, { a: 'a', b: 1, c: true, d: null, e: undefined, f: null, g: 'g' })

    expect(result.length).toBe(0)
  })

  test('Uses custom validators with correct input', () => {
    const value = 'test'
    const validator: Validator<string> = { onValidate: x => x === value }

    const result = validateObject({
      a: { type: 'string', validators: [validator, validator] }
    }, { a: value })

    expect(result.length).toBe(0)
  })

  test('Does not call validator for optional or null objects if the value is not provided', () => {
    const result = validateObject({
      a: { type: 'number', nullable: true, validators: [{ onValidate: () => { throw new Error('Validator should not be called') }}] },
      b: { type: 'number', optional: true, validators: [{ onValidate: () => { throw new Error('Validator should not be called') }}] }
    }, { a: null, b: undefined })
  })

  test('Validates a flat object with optionals and nullables and incorrect input', () => {
    const result = validateObject({
      a: { type: 'string' },
      b: { type: 'number' },
      c: { type: 'boolean' },
      d: { type: 'string', nullable: true },
      e: { type: 'number', optional: true },
      f: { type: 'boolean', optional: true, nullable: true },
      g: { type: 'string', optional: true, nullable: true },
      h: { type: 'number' }
    }, { a: 1, b: [true], c: 'true', d: undefined, e: null, f: 2, g: false, h: NaN } as any)

    expect(result.length).toBe(8)
  })

  test('Uses custom validators with incorrect input', () => {
    const value = 'test'
    const validatorSucceed: Validator<string> = { onValidate: x => x === value }
    const validatorFail: Validator<string> = { onValidate: x => x !== value, errorMessage: 'testMessage' }

    const result = validateObject({
      a: { type: 'string', validators: [validatorSucceed, validatorFail] }
    }, { a: value })

    expect(result.length).toBe(1)
    expect(single(result).stringify()).toEqual('a (testMessage)')
  })

  test('Validates arrays with correct input', () => {
    const result = validateObject({
      a: { type: 'string', isArray: true },
      b: { type: 'number', isArray: true },
      c: { type: 'boolean', isArray: true }
    }, { a: [''], b: [1, 2], c: [true] })

    expect(result.length).toBe(0)
  })

  test('Uses custom validators for arrays with correct input', () => {
    const singleValidator: ArrayValidator<number> = { onValidateEach: (value, index) => value === index * 2 }
    const fullValidator: ArrayValidator<number> = { onValidateAll: (arr) => arr.length === 4 }

    const result = validateObject({
      a: { type: 'number', isArray: true, validators: [singleValidator, fullValidator] }
    }, { a: [0, 2, 4, 6] })

    expect(result.length).toBe(0)
  })

  test('Validates arrays with incorrect input', () => {
    const result = validateObject({
      a: { type: 'string', isArray: true },
      b: { type: 'number', isArray: true },
      c: { type: 'boolean', isArray: true },
      d: { type: 'number', isArray: true }
    }, { a: '', b: [1, 2, ''], c: {}, d: [NaN] } as any)

    expect(result.length).toBe(4)
  })

  test('Uses custom validators for arrays with incorrect input', () => {
    const singleValidator: ArrayValidator<number> = { onValidateEach: (value, index) => value === index * 2 }
    const fullValidator: ArrayValidator<number> = { onValidateAll: (arr) => arr.length === 3, errorMessageForAll: 'test' }

    const result = validateObject({
      a: { type: 'number', isArray: true, validators: [singleValidator, fullValidator] }
    }, { a: [0, 2, 5, 6] })

    expect(result.length).toBe(1)
    expect(single(result[0].errorMessages)).toBe('test')
  })

  test('Null objects are invalid', () => {
    const result = validateObject({
      a: { type: 'number' }
    }, null as any)

    expect(result.length).toBe(1)
  })

  test('Nested null objects are invalid', () => {
    const result = validateObject({
      a: { type: 'object', body: { b: { type: 'number' } } }
    }, { a: null } as any)

    expect(result.length).toBe(1)
  })
})
