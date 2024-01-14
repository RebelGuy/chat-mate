import { ARGS, DB_PROVIDER } from '@rebel/server/scripts/consts'
import AccountService from '@rebel/server/services/AccountService'
import AccountStore from '@rebel/server/stores/AccountStore'
import { Dependencies } from '@rebel/shared/context/context'
import AccountHelpers from '@rebel/shared/helpers/AccountHelpers'
import { isNullOrEmpty } from '@rebel/shared/util/strings'

// admin script to reset the password for a user.
// usage: `yarn workspace server reset-password:<local|debug|release> <username> <new password>`

const [username, password] = ARGS
if (isNullOrEmpty(username)) {
  throw new Error('Username must be defined.')
} else if (isNullOrEmpty(password)) {
  throw new Error('Password must be defined.')
}

const accountHelpers = new AccountHelpers()
const accountStore = new AccountStore(new Dependencies({
  dbProvider: DB_PROVIDER
}))
const accountService = new AccountService(new Dependencies({
  accountStore: accountStore,
  channelStore: null!
}))
const formattedUsername = accountHelpers.validateAndFormatUsername(username)

const _ = (async () => {
  try {
    const registeredUser = await accountStore.getRegisteredUserFromName(formattedUsername)
    if (registeredUser == null) {
      throw new Error('Could not find registered user')
    }

    await accountService.resetPassword(registeredUser.id, password)
    console.log(`Successfully updated password for user ${formattedUsername}`)

  } catch (e) {
    console.error(`Failed to update password for user ${formattedUsername}:`, e)
  }
})()
