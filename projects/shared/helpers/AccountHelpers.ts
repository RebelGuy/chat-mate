import ContextClass from '@rebel/shared/context/ContextClass'
import { unique } from '@rebel/shared/util/arrays'
import { InvalidUsernameError } from '@rebel/shared/util/error'

const allowedCharacters = 'abcdefghijklmnopqrstuvwxyz1234567890-_.'

export default class AccountHelpers extends ContextClass {
  /** Returns the formatted username.
   * @throws {@link InvalidUsernameError}: When the username is not valid. */
  public validateAndFormatUsername (username: string): string {
    username = username.trim().toLowerCase()

    let errors: string[] = []
    if (username.length > 20) {
      errors.push('Username cannot be longer than 20 characters')
    }

    for (const c of username) {
      if (!allowedCharacters.includes(c)) {
        errors.push(`Invalid character '${c}'`)
      }
    }

    if (errors.length > 0) {
      throw new InvalidUsernameError(unique(errors).join('; '))
    }

    return username
  }
}
