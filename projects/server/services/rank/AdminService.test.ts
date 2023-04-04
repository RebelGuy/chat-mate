import { Rank } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import AdminService from '@rebel/server/services/rank/AdminService'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import AuthStore from '@rebel/server/stores/AuthStore'
import WebService from '@rebel/server/services/WebService'
import { single2 } from '@rebel/shared/util/arrays'

const primaryUser1 = 1
const primaryUser2 = 2
const primaryUser3 = 3

const adminRank = cast<Rank>({ name: 'admin' })
const modRank = cast<Rank>({ name: 'mod' })
const ownerRank = cast<Rank>({ name: 'owner' })

let mockRankStore: MockProxy<RankStore>
let mockAuthStore: MockProxy<AuthStore>
let mockWebService: MockProxy<WebService>
const mockStudioUrl = 'studio'
const mockTwitchClientId = 'clientId'
const mockTwitchClientSecret = 'clientSecret'
let adminService: AdminService

beforeEach(() => {
  mockRankStore = mock()
  mockAuthStore = mock()
  mockWebService = mock()

  adminService = new AdminService(new Dependencies({
    rankStore: mockRankStore,
    authStore: mockAuthStore,
    webService: mockWebService,
    logService: mock(),
    studioUrl: mockStudioUrl,
    twitchClientId: mockTwitchClientId,
    twitchClientSecret: mockTwitchClientSecret
  }))
})

describe(nameof(AdminService, 'getAdminUsers'), () => {
  test('Returns the array of all current admin users', async () => {
    const streamerId = 2
    mockRankStore.getUserRanksForGroup.calledWith('administration', streamerId).mockResolvedValue(cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUser1, rank: modRank },
      { primaryUserId: primaryUser1, rank: adminRank },
      { primaryUserId: primaryUser2, rank: ownerRank },
      { primaryUserId: primaryUser2, rank: adminRank },
      { primaryUserId: primaryUser3, rank: ownerRank },
      { primaryUserId: primaryUser3, rank: modRank }
    ]))

    const result = await adminService.getAdminUsers(streamerId)

    expect(result.map(r => r.chatUserId)).toEqual([primaryUser1, primaryUser2])
  })
})

describe(nameof(AdminService, 'getTwitchLoginUrl'), () => {
  test('Returns a URL', () => {
    const url = adminService.getTwitchLoginUrl()

    expect(url).not.toBeNull()
  })
})

describe(nameof(AdminService, 'authoriseTwitchLogin'), () => {
  test('Sends an authorisation request and saves the provided access token to the database', async () => {
    const code = 'code123'
    const access_token = 'access_token123'
    const refresh_token = 'refresh_token123'
    mockWebService.fetch
      .calledWith(expect.stringContaining(code))
      .mockResolvedValue(cast<Response>({ ok: true, json: () => Promise.resolve({ access_token, refresh_token }) }))

    await adminService.authoriseTwitchLogin(code)

    const storedToken = single2(mockAuthStore.saveTwitchAccessToken.mock.calls)
    expect(storedToken).toEqual(expectObject(storedToken, { accessToken: access_token, refreshToken: refresh_token }))
  })
})
