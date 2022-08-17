import { Dependencies } from '@rebel/server/context/context'
import DonationFetchService from '@rebel/server/services/DonationFetchService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import { single } from '@rebel/server/util/arrays'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockStreamlabsProxyService: MockProxy<StreamlabsProxyService>
let donationFetchService: DonationFetchService

beforeEach(() => {
  mockStreamlabsProxyService = mock()

  donationFetchService = new DonationFetchService(new Dependencies({
    streamlabsProxyService: mockStreamlabsProxyService
  }))
})

describe(nameof(DonationFetchService, 'initialise'), () => {
  test('Fetches initial donations, then subscribes to new donations, and notifies the <insert service>', async () => {
    const initialDonations = cast<StreamlabsDonation[]>([
      { donationId: 1 },
      { donationId: 2 },
      { donationId: 3 },
    ])
    mockStreamlabsProxyService.getDonationsAfterId.mockResolvedValue(initialDonations)

    await donationFetchService.initialise()

    // todo: verify service methods called

    const additionalDonation = cast<StreamlabsDonation>({ donationId: 4 })
    const callback = single(single(mockStreamlabsProxyService.listen.mock.calls))

    await callback(additionalDonation)

    // todo: verify service methods called
  })
})
