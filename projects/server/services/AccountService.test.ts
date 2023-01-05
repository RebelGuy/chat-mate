import { Dependencies } from '@rebel/server/context/context'
import AccountService from '@rebel/server/services/AccountService'
import AccountStore from '@rebel/server/stores/AccountStore'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockAccountStore: MockProxy<AccountStore>
let accountService: AccountService

beforeEach(() => {
  mockAccountStore = mock()

  accountService = new AccountService(new Dependencies({
    accountStore: mockAccountStore
  }))
})
