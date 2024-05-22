import { assertUnreachable } from '@rebel/shared/util/typescript'

const testSchema = {
  id: {
    type: 'string',
    validators: [{ onValidate: x => true }]
  }
} satisfies Schema

type Test = SchemaType<typeof testSchema>
//   ^?

export type Schema = Record<string, SchemaEntry>

// for now, don't allow objects to be arrays because it's a little tricky.
// we can't pretty-up this type using a generic for `isArray`, otherwise typescript complains about circular references (why doesn't it already lol)
type SchemaEntry = {
  optional?: boolean
  nullable?: boolean
} & ({
  type: 'string'
  validators?: Validator<string>[]
  isArray?: false
} | {
  type: 'boolean'
  validators?: Validator<boolean>[]
  isArray?: false
} | {
  type: 'number'
  validators?: Validator<number>[]
  isArray?: false
} | {
  type: 'string'
  validators?: ArrayValidator<string>[]
  isArray: true
} | {
  type: 'boolean'
  validators?: ArrayValidator<boolean>[]
  isArray: true
} | {
  type: 'number'
  validators?: ArrayValidator<number>[]
  isArray: true
} | {
  type: 'object'
  body: Schema
  isArray?: false
})

export type Validator<T> = {
  errorMessage?: string | ((value: T) => string) // function only called if the value is actually invalid
  onValidate: (value: T) => boolean
}

export type ArrayValidator<T> = {
  errorMessageForSingle?: (value: T, index: number, array: T[]) => string // only called for invalid items
  errorMessageForAll?: string | ((value: T[]) => string) // function only called if there is an invalid value
  onValidateEach?: (value: T, index: number, array: T[]) => boolean
  onValidateAll?: (value: T[]) => boolean
}

// I tried to make this recursive. it works, except the type information of nested objects is not evaluated (they are shown only as `ParseSchema<...>` which is not helpful)
export type SchemaType<T extends Schema> = {
  [K in keyof T]:
    T[K] extends { type: 'string' } ? ParseType<T[K], string> :
    T[K] extends { type: 'number' } ? ParseType<T[K], number> :
    T[K] extends { type: 'boolean' } ? ParseType<T[K], boolean> :
    T[K] extends { type: 'object', body: infer T1 extends Schema } ? ParseType<T[K], {
      [K1 in keyof T1]:
        T1[K1] extends { type: 'string' } ? ParseType<T1[K1], string> :
        T1[K1] extends { type: 'number' } ? ParseType<T1[K1], number> :
        T1[K1] extends { type: 'boolean' } ? ParseType<T1[K1], boolean> :
        T1[K1] extends { type: 'object', body: infer T2 extends Schema } ? ParseType<T1[K1], {
          [K2 in keyof T2]:
            T2[K2] extends { type: 'string' } ? ParseType<T2[K2], string> :
            T2[K2] extends { type: 'number' } ? ParseType<T2[K2], number> :
            T2[K2] extends { type: 'boolean' } ? ParseType<T2[K2], boolean> :
            never // extend deeper as needed
        }> :
        never
    }> :
    never
}

/** Returns the schema type and makes it nullable or optional if required */
type ParseType<T extends Extract<SchemaEntry, { type: SchemaEntry['type'] }>, U> =
  CombineConditionally<
    CombineConditionally<
      T['isArray'] extends true ? U[] : U,
      null,
      T['nullable']
    >,
    undefined,
    T['optional']
  >

/** combines `T` and `U` if the `Condition` is `true` */
type CombineConditionally<T, U, Condition extends boolean | undefined> = Condition extends true ? T | U : T

export function validateObject<S extends Schema> (schema: S, input: SchemaType<S>): InvalidInput[] {
  let invalidInputs: InvalidInput[] = []
  validateObjectRecursively(schema, input, null, invalidInputs)
  return invalidInputs
}

function validateObjectRecursively<S extends Schema> (schema: S, input: SchemaType<S>, namespace: string | null, invalidInputs: InvalidInput[]) {
  if (input == null) {
    invalidInputs.push(new InvalidInput(namespace ?? '<root>', 'Input must be defined'))
    return
  }

  for (const property of Object.keys(schema)) {
    const entry = schema[property]
    const value = input[property] as any
    const fullProperty = namespace == null ? property : `${namespace}.${property}`

    if (entry.optional && value === undefined || entry.nullable && value === null) {
      continue
    }

    if (!entry.optional && value === undefined) {
      invalidInputs.push(new InvalidInput(fullProperty, 'Value must be defined'))
      continue
    } else if (!entry.nullable && value === null) {
      invalidInputs.push(new InvalidInput(fullProperty, 'Value cannot be null'))
      continue
    } else if (entry.isArray && !Array.isArray(value)) {
      invalidInputs.push(new InvalidInput(fullProperty, 'Value must be an array'))
      continue
    }

    if (!entry.isArray && !checkType(value, entry.type)) {
      invalidInputs.push(new InvalidInput(fullProperty, `Value must be a ${entry.type}`))
      continue
    } else if (entry.isArray && (value as any[]).some(x => !checkType(x, entry.type))) {
      invalidInputs.push(new InvalidInput(fullProperty, `Value must be an array of ${entry.type}s`))
      continue
    }

    if (entry.type === 'string' || entry.type === 'number' || entry.type === 'boolean') {
      if (entry.validators == null) {
        continue
      }

      let invalidInput: InvalidInput | null = null

      if (!entry.isArray) {
        for (const validator of entry.validators as Validator<any>[]) {
          if (!validator.onValidate(value)) {
            let errorMessage: string | null = null
            if (typeof validator.errorMessage === 'string') {
              errorMessage = validator.errorMessage
            } else if (typeof validator.errorMessage === 'function') {
              errorMessage = validator.errorMessage(value)
            }

            if (invalidInput == null) {
              invalidInput = new InvalidInput(fullProperty, errorMessage)
            } else {
              invalidInput.withErrorMessage(errorMessage)
            }
          }
        }
      } else {
        for (const validator of entry.validators as ArrayValidator<any>[]) {
          // first pass: check all
          if (validator.onValidateAll !=  null && !validator.onValidateAll(value)) {
            let errorMessage: string | null = null
            if (typeof validator.errorMessageForAll === 'string') {
              errorMessage = validator.errorMessageForAll
            } else if (typeof validator.errorMessageForAll === 'function') {
              errorMessage = validator.errorMessageForAll(value)
            }

            if (invalidInput == null) {
              invalidInput = new InvalidInput(fullProperty, errorMessage)
            } else {
              invalidInput.withErrorMessage(errorMessage)
            }
          }

          // second pass: check each
          if (validator.onValidateEach != null) {
            for (let i = 0; i < value.length; i++) {
              if (validator.onValidateEach(value[i], i, value)) {
                continue
              }

              let errorMessage: string | null = null
              if (typeof validator.errorMessageForSingle === 'function') {
                errorMessage = validator.errorMessageForSingle(value[i], i, value)
              }

              if (invalidInput == null) {
                invalidInput = new InvalidInput(`${fullProperty}[${i}]`, errorMessage)
              } else {
                invalidInput.withErrorMessage(errorMessage)
              }
            }
          }
        }
      }

      if (invalidInput != null) {
        invalidInputs.push(invalidInput)
        continue
      }

    } else if (entry.type === 'object') {
      validateObjectRecursively(entry.body, value, fullProperty, invalidInputs)
    } else {
      assertUnreachable(entry)
    }
  }
}

function checkType (value: any, expectedType: 'string' | 'boolean' | 'number' | 'object') {
  if (typeof value !== expectedType) {
    return false
  }

  if (expectedType === 'number' && isNaN(value)) {
    return false
  } else {
    return true
  }
}

class InvalidInput {
  public readonly inputName: string
  public readonly errorMessages: string[]

  constructor (inputName: string, errorMessage: string | null = null) {
    this.inputName = inputName
    this.errorMessages = errorMessage == null ? [] : [errorMessage]
  }

  withErrorMessage (errorMessage: string | null) {
    if (errorMessage == null) {
      return
    }

    this.errorMessages.push(errorMessage)
  }

  stringify () {
    if (this.errorMessages.length === 0) {
      return `${this.inputName}`
    } else {
      return `${this.inputName} (${this.errorMessages.join('; ')})`
    }
  }
}
