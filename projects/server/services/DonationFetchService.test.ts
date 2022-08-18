import { Dependencies } from '@rebel/server/context/context'
import DonationFetchService from '@rebel/server/services/DonationFetchService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import DonationStore from '@rebel/server/stores/DonationStore'
import { single } from '@rebel/server/util/arrays'
import { cast, expectArray, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockStreamlabsProxyService: MockProxy<StreamlabsProxyService>
let mockDonationStore: MockProxy<DonationStore>
let donationFetchService: DonationFetchService

beforeEach(() => {
  mockStreamlabsProxyService = mock()
  mockDonationStore = mock()

  donationFetchService = new DonationFetchService(new Dependencies({
    streamlabsProxyService: mockStreamlabsProxyService,
    donationStore: mockDonationStore
  }))
})

describe(nameof(DonationFetchService, 'initialise'), () => {
  test('Fetches initial donations, then subscribes to new donations, and notifies the <insert service>', async () => {
    // part 1: initialisation
    const initialDonations = cast<StreamlabsDonation[]>([
      { donationId: 1 },
      { donationId: 2 },
      { donationId: 3 },
    ])
    mockStreamlabsProxyService.getDonationsAfterId.mockResolvedValue(initialDonations)

    await donationFetchService.initialise()

    const initialAddedDonations = mockDonationStore.addDonation.mock.calls.map(args => single(args).streamlabsId)
    expect(initialAddedDonations).toEqual(expectArray(initialDonations.map(d => d.donationId)))

    // part 2: subscription
    mockDonationStore.addDonation.mockClear()
    const additionalDonation = cast<StreamlabsDonation>({ donationId: 4 })
    const callback = single(single(mockStreamlabsProxyService.listen.mock.calls))

    await callback(additionalDonation)

    const additionalAddedDonation = single(single(mockDonationStore.addDonation.mock.calls)).streamlabsId
    expect(additionalAddedDonation).toEqual(additionalDonation.donationId)
  })
})
