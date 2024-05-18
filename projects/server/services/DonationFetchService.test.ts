import { Dependencies } from '@rebel/shared/context/context'
import DonationFetchService from '@rebel/server/services/DonationFetchService'
import DonationService from '@rebel/server/services/DonationService'
import StreamlabsProxyService, { StreamlabsDonation } from '@rebel/server/services/StreamlabsProxyService'
import { cast, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import EventDispatchService from '@rebel/server/services/EventDispatchService'

const streamerId = 1

let mockStreamlabsProxyService: MockProxy<StreamlabsProxyService>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockDonationService: MockProxy<DonationService>
let donationFetchService: DonationFetchService

beforeEach(() => {
  mockStreamlabsProxyService = mock()
  mockEventDispatchService = mock()
  mockDonationService = mock()

  donationFetchService = new DonationFetchService(new Dependencies({
    streamlabsProxyService: mockStreamlabsProxyService,
    eventDispatchService: mockEventDispatchService,
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
    mockStreamlabsProxyService.getDonationsAfterId.calledWith(1, -1).mockResolvedValue(initialDonations)

    await donationFetchService.initialise()

    // commented out until we properly support the streamlabs API

    // const initialAddedDonations = mockDonationService.addDonation.mock.calls.map((args: [donation: NewDonation, streamerId: number]) => [args[0].streamlabsDonationId, args[1]])
    // expect(initialAddedDonations).toEqual(expectArray(initialDonations.map(d => [d.donationId, 1]))) // todo: properly handle streamerId

    // part 2: subscription
    // mockDonationService.addDonation.mockClear()
    // const additionalDonation = cast<StreamlabsDonation>({ donationId: 4 })
    // const callback = single(single(mockStreamlabsProxyService.setDonationCallback.mock.calls))

    // await callback(additionalDonation, streamerId)

    // const additionalAddedDonation: [donation: NewDonation, streamerId: number] = single(mockDonationService.addDonation.mock.calls)
    // expect(additionalAddedDonation).toEqual([{ streamlabsDonationId: additionalDonation.donationId }, streamerId])
  })
})
