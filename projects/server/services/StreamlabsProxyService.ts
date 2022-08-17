import { Dependencies } from '@rebel/server/context/context'
import { NodeEnv } from '@rebel/server/globals'
import ApiService from '@rebel/server/services/abstract/ApiService'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import { single } from '@rebel/server/util/arrays'
import { ApiResponseError } from '@rebel/server/util/error'
import { throws } from 'node:assert'

// we have to use this ancient version thanks to the fantastic work of the streamlabs devs!
// https://stackoverflow.com/a/67447804
import io from 'socket.io-client'

// https://dev.streamlabs.com/docs/currency-codes
const CURRENCIES = {
  AUD: 'Australian Dollar',
  BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',
  CZK: 'Czech Koruna',
  DKK: 'Danish Krone',
  EUR: 'Euro',
  HKD: 'Hong Kong Dollar',
  ILS: 'Israeli New Sheqel',
  MYR: 'Malaysian Ringgit',
  MXN: 'Mexican Peso',
  NOK: 'Norwegian Krone',
  NZD: 'New Zealand Dollar',
  PHP: 'Philippine Peso',
  PLN: 'Polish Zloty',
  GBP: 'Pound Sterling',
  RUB: 'Russian Ruble',
  SGD: 'Singapore Dollar',
  SEK: 'Swedish Krona',
  CHF: 'Swiss Franc',
  THB: 'Thai Baht',
  TRY: 'Turkish Lira',
  USD: 'US Dollar'
}

const REST_BASE_URL = 'https://streamlabs.com/api/v1.0'

const SOCKET_BASE_URL = 'https://sockets.streamlabs.com'

export type CurrencyCode = keyof typeof CURRENCIES

export type StreamlabsDonation = {
  donationId: number
  createdAt: number
  // for WebSocket respones, the currency is always converted into USD
  currency: CurrencyCode
  amount: number
  name: string
  message: string | null
}

export type DonationCallback = (donation: StreamlabsDonation) => void | Promise<void>

type GetDonationsRequestParams = Partial<{
  limit: number // defaults to `10`
  before: number
  after: number
  currency: string
  // 1: response will only include verified donations from paypal, credit card, skrill and unitpay
  // 0: response will only include streamer added donations from My Donations page
  // undefined: if you want to include both
  verified: 1 | 0 | undefined
  sort_by: string // defaults to `created_at`
  direction: string // defaults to `desc`
  date_from: string // in ISO 8601 format
  date_to: string // in ISO 8601 format
}>

type Stringify<T> = { [K in keyof T]: string }

type GetDonationsResponse = {
  data: [{
    donation_id: string
    created_at: string
    currency: string
    amount: string
    name: string
    message: string | null
  }]
}

// https://streamlabs.readme.io/docs/socket-api
type WebsocketMessage = {
  event_id: `evt_${string}`
} & ({
  type: 'donation'
  for: '' | 'streamlabs'
  message: [{
    id: number
    name: string
    amount: string
    formatted_amount: string
    formattedAmount: string
    message: string | null
    currency: CurrencyCode
    emotes: null
    iconClassName: string
    to: { name: string }
    from: string
    from_user_id: null | any // todo: string or number
    _id: string
  }]
} | { type: '' })

type Deps = Dependencies<{
  streamlabsAccessToken: string
  streamlabsSocketToken: string
  streamlabsStatusService: StatusService
  logService: LogService
  nodeEnv: NodeEnv
}>

export default class StreamlabsProxyService extends ApiService {
  private readonly accessToken: string
  private readonly socketToken: string
  private readonly nodeEnv: NodeEnv

  private donationCallback: DonationCallback | null
  private readonly webSocket: SocketIOClient.Socket

  constructor (deps: Deps) {
    const name = StreamlabsProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('streamlabsStatusService')
    const timeout = null
    super(name, logService, statusService, timeout)
  
    this.accessToken = deps.resolve('streamlabsAccessToken')
    this.socketToken = deps.resolve('streamlabsSocketToken')
    this.nodeEnv = deps.resolve('nodeEnv')

    this.donationCallback = null
    this.webSocket = io(SOCKET_BASE_URL + `?token=${this.socketToken}`, {
      reconnection: true,
      reconnectionDelay: 10000,
      autoConnect: false
    })
  }

  public override dispose (): void | Promise<void> {
    this.webSocket.disconnect()
  }

  // https://streamlabs.readme.io/docs/donations
  /** Returns the first 100 donations donations in descending order after the given ID.
   * @throws {@link ApiResponseError} */
  public async getDonationsAfterId (id: number | null): Promise<StreamlabsDonation[]> {
    // todo: the access_token doesn't work (returns 401), so the only way to get this to work
    // would be to properly implement the OAuth2 flow described in https://rebel-guy.atlassian.net/browse/CHAT-378?focusedCommentId=10079
    return []

    // todo: will need to implement pagination in the future, but will work just fine for low volumes of data
    const params: Stringify<GetDonationsRequestParams> = {
      limit: '100',
      verified: this.nodeEnv === 'release' ? '1' : '0',
      after: id == null ? undefined : `${id}`
    }
    const donations = await this.makeRequest<GetDonationsResponse>('GET', '/donations', new URLSearchParams(params))

    return donations.data.map(d => ({
      amount: Number.parseFloat(d.amount),
      createdAt: Number.parseInt(d.created_at),
      currency: d.currency as CurrencyCode,
      donationId: Number.parseInt(d.donation_id),
      message: d.message,
      name: d.name
    }))
  }

  public listen (callback: DonationCallback) {
    if (this.donationCallback != null) {
      throw new Error('Already listening')
    }

    this.donationCallback = callback
    this.webSocket.on('event', this.onSocketData)
    this.webSocket.on('connect', () => this.logService.logInfo(this, 'WebSocket connected'))
    this.webSocket.on('connect_error', (e: any) => this.logService.logInfo(this, 'WebSocket encountered an error:', e.message))
    this.webSocket.on('disconnect', (reason: any) => this.logService.logInfo(this, 'WebSocket disconnected. Reason:', reason))
    this.webSocket.connect()
  }

  private onSocketData = async (data: WebsocketMessage) => {
    if (data.type !== 'donation') {
      return
    }

    const message = single(data.message)
    const donation: StreamlabsDonation = {
      amount: Number.parseFloat(message.amount),
      createdAt: new Date().getTime(),
      currency: message.currency,
      donationId: message.id,
      message: message.message,
      name: message.from
    }

    try {
      await this.donationCallback!(donation)
    } catch (e: any) {
      this.logService.logError(this, `Donation callback failed to run for donation id ${donation.donationId}:`, e)
    }
  }

  private async makeRequest<T> (method: 'GET' | 'POST', path: `/${string}`, params?: URLSearchParams): Promise<T> {
    params = params ?? new URLSearchParams()
    params.append('access_token', this.accessToken)
    
    const requestName = `${method} ${path}`
    const wrappedRequest = this.wrapRequest(async () => {
      const response = await fetch(`${REST_BASE_URL}${path}?${params}`, {
        method: method
      })
      
      const json = await response.json()
      if (response.ok) {
        return json
      } else {
        throw new ApiResponseError(response.status, json.error, json.error_description)
      }
    }, requestName)
    return await wrappedRequest()
  }
}
