import ContextClass from '@rebel/server/context/ContextClass'
import { unique } from '@rebel/server/util/arrays'
import { InvalidUsernameError } from '@rebel/server/util/error'

const allowedCharacters = 'abcdefghijklmnopqrstuvwxyz1234567890-_.'

export default class AccountHelpers extends ContextClass {
  /** Returns the formatted username.
   * @throws {@link InvalidUsernameError}: When the username is not valid. */
  public validateAndFormatUsername (username: string): string {
    username = username.trim().toLowerCase()

    let errors: string[] = []
    for (const c of username) {
      if (!allowedCharacters.includes(c)) {
        errors.push(`Invalid character ${c}`)
      }
    }

    if (errors.length > 0) {
      throw new InvalidUsernameError(unique(errors).join('; '))
    }

    return username
  }
}