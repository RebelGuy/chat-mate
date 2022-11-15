import { Dependencies } from '@rebel/server/context/context'
import DonationFetchService from '@rebel/server/services/DonationFetchService'
import DonationService from '@rebel/server/services/DonationService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import { single } from '@rebel/server/util/arrays'
import { cast, expectArray, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

const streamerId = 1

let mockStreamlabsProxyService: MockProxy<StreamlabsProxyService>
let mockDonationService: MockProxy<DonationService>
let donationFetchService: DonationFetchService

beforeEach(() => {
  mockStreamlabsProxyService = mock()
  mockDonationService = mock()

  donationFetchService = new DonationFetchService(new Dependencies({
    streamlabsProxyService: mockStreamlabsProxyService,
    donationService: mockDonationService
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
    mockStreamlabsProxyService.getDonationsAfterId.calledWith(-1).mockResolvedValue(initialDonations)

    await donationFetchService.initialise()

    const initialAddedDonations = mockDonationService.addDonation.mock.calls.map((args: [donation: StreamlabsDonation, streamerId: number]) => [args[0].donationId, args[1]])
    expect(initialAddedDonations).toEqual(expectArray(initialDonations.map(d => [d.donationId, 1]))) // todo: properly handle streamerId

    // part 2: subscription
    mockDonationService.addDonation.mockClear()
    const additionalDonation = cast<StreamlabsDonation>({ donationId: 4 })
    const callback = single(single(mockStreamlabsProxyService.setDonationCallback.mock.calls))

    await callback(additionalDonation, streamerId)

    const additionalAddedDonation: [donation: StreamlabsDonation, streamerId: number] = single(mockDonationService.addDonation.mock.calls)
    expect(additionalAddedDonation).toEqual([additionalDonation, streamerId])
  })
})
