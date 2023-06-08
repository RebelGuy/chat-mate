import AccountHelpers from '@rebel/shared/helpers/AccountHelpers'
import { InvalidUsernameError } from '@rebel/shared/util/error'
import { nameof } from '@rebel/shared/testUtils'

let accountHelpers: AccountHelpers

beforeEach(() => {
  accountHelpers = new AccountHelpers()
})

describe(nameof(AccountHelpers, 'validateAndFormatUsername'), () => {
  test('Returns valid username', () => {
    const username = 'valid.username'

    const result = accountHelpers.validateAndFormatUsername(username)

    expect(result).toBe(username)
  })

  test('Formats and returns valid username', () => {
    const username = 'Valid.Username'

    const result = accountHelpers.validateAndFormatUsername(username)

    expect(result).toBe('valid.username')
  })

  test('Throws on invalid username', () => {
    const username = '!@#$'

    expect(() => accountHelpers.validateAndFormatUsername(username)).toThrowError(InvalidUsernameError)
  })
})
