import { Validator } from '@rebel/server/controllers/schema'
import { isNullOrEmpty } from '@rebel/shared/util/strings'

export const nonEmptyStringValidator: Validator<string> = {
  onValidate: s => !isNullOrEmpty(s),
  errorMessage: 'Value must be non-empty'
}

export function generateStringRangeValidator (...allowedStrings: string[]): Validator<string> {
  return {
    onValidate: s => allowedStrings.includes(s),
    errorMessage: `Value must be one of: ${allowedStrings.map(s => `"${s}"`).join(', ')}`
  }
}

export function generateStringLengthValidator (minLength: number): Validator<string> {
  return {
    onValidate: s => s.length >= minLength,
    errorMessage: `Value must be at least ${minLength} characters long`
  }
}

export function generateExclusiveNumberRangeValidator (minNumber: number | undefined, maxNumber: number | undefined): Validator<number> {
  return {
    onValidate: n => (minNumber == null || n > minNumber) && (maxNumber == null || n < maxNumber),
    errorMessage: `Value must be greater than ${minNumber} and less than ${maxNumber}`
  }
}

export function generateInclusiveNumberRangeValidator (minNumber: number | undefined, maxNumber: number | undefined): Validator<number> {
  return {
    onValidate: n => (minNumber == null || n >= minNumber) && (maxNumber == null || n <= maxNumber),
    errorMessage: `Value must be between ${minNumber} and ${maxNumber}`
  }
}

export const positiveNumberValidator: Validator<number> = {
  onValidate: n => n > 0,
  errorMessage: 'Value must be positive'
}
