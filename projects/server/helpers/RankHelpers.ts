import ContextClass from '@rebel/shared/context/ContextClass'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { InvalidCustomRankNameError } from '@rebel/shared/util/error'
import { unique } from '@rebel/shared/util/arrays'

const ALLOWED_CUSTOM_NAME_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz1234567890,<.>/?;:\'"[{]}\\|`~!@#$%^&*()-_=+§ '

const MINEPLEX_RANKS = ['trainee', 'mod', 'sr.mod', 'sr mod', 'sr. mod', 'admin', 'youtube', 'stream', 'owner', 'dev', 'helper']

const MIN_CUSTOM_NAME_LENGTH = 1

const MAX_CUSTOM_NAME_LENGTH = 8

export default class RankHelpers extends ContextClass {
  /** Checks if the given rank is currently active, or whether it was active at the provided time. */
  public isRankActive (rank: UserRankWithRelations, atTime: Date = new Date()): boolean {
    return rank.issuedAt <= atTime && (rank.expirationTime == null || rank.expirationTime > atTime) && (rank.revokedTime == null || rank.revokedTime > atTime)
  }

  /** Checks that the custom rank name is valid, and returns the sanitises rank name.
   * @throws {@link InvalidCustomRankName}: When the custom name provided fails validation.
   */
  public validateCustomRankName (customRankName: string): string {
    const name = customRankName.trim()

    let errors: string[] = []
    if (name.length < MIN_CUSTOM_NAME_LENGTH) {
      errors.push(`Custom rank name must be at least ${MIN_CUSTOM_NAME_LENGTH} character long`)
    } else if (name.length > MAX_CUSTOM_NAME_LENGTH) {
      errors.push(`Custom rank name must be at most ${MAX_CUSTOM_NAME_LENGTH} characters long`)
    }

    for (const c of name) {
      if (!ALLOWED_CUSTOM_NAME_CHARACTERS.includes(c)) {
        errors.push(`Invalid character '${c}'`)
      }
    }

    if (MINEPLEX_RANKS.includes(name.toLowerCase())) {
      errors.push(`The rank name ${name} is not allowed`)
    }

    if (errors.length > 0) {
      throw new InvalidCustomRankNameError(unique(errors).join('; '))
    }

    return name
  }
}
