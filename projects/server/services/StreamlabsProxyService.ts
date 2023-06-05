import { Dependencies } from '@rebel/shared/context/context'
import WebsocketFactory, { DisconnectReason, WebsocketAdapter } from '@rebel/server/factories/WebsocketFactory'
import { NodeEnv } from '@rebel/server/globals'
import ApiService from '@rebel/server/services/abstract/ApiService'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import { single } from '@rebel/shared/util/arrays'
import { ApiResponseError } from '@rebel/shared/util/error'
import { throws } from 'node:assert'



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
  streamlabsUserId: number | null
  createdAt: number
  currency: CurrencyCode
  amount: number
  formattedAmount: string
  name: string
  message: string | null
}

export type DonationCallback = (donation: StreamlabsDonation, streamerId: number) => void | Promise<void>

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
    amount: string // decimal in the destination currency with at least 2 decimal places
    formatted_amount: string // e.g. "A$1.00". Streamlabs converts it to the currency set on the dashboard
    formattedAmount: string
    message: string | null
    currency: CurrencyCode // same as whatever is configured in Streamlabs
    emotes: string | null
    iconClassName: string // e.g. "fab paypal"
    to: { name: string }
    from: string // same as `name`
    from_user_id: null | number // set if the user is logged into streamlabs
    donation_currency: CurrencyCode // the original currency used to make the donation
    source: string // e.g. paypal
    _id: string
    priority: number // always 10, no idea what it means
  }]
} | { type: '' })

type Deps = Dependencies<{
  streamlabsAccessToken: string
  streamlabsStatusService: StatusService
  logService: LogService
  nodeEnv: NodeEnv
  websocketFactory: WebsocketFactory
}>

export default class StreamlabsProxyService extends ApiService {
  private readonly accessToken: string
  private readonly nodeEnv: NodeEnv
  private readonly websocketFactory: WebsocketFactory

  private donationCallback: DonationCallback | null
  private readonly streamerWebSockets: Map<number, SocketIOClient.Socket>

  constructor (deps: Deps) {
    const name = StreamlabsProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('streamlabsStatusService')
    const timeout = null
    super(name, logService, statusService, timeout, false)

    this.accessToken = deps.resolve('streamlabsAccessToken')
    this.nodeEnv = deps.resolve('nodeEnv')
    this.websocketFactory = deps.resolve('websocketFactory')

    this.donationCallback = null
    this.streamerWebSockets = new Map()
  }

  public override dispose (): void | Promise<void> {
    for (const [_, socket] of this.streamerWebSockets) {
      socket.disconnect()
    }
  }

  // https://streamlabs.readme.io/docs/donations
  /** Returns the first 100 donations donations in descending order after the given ID.
   * @throws {@link ApiResponseError} */
  public async getDonationsAfterId (id: number | null): Promise<StreamlabsDonation[]> {
    // todo: the access_token doesn't work (returns 401), so the only way to get this to work
    // would be to properly implement the OAuth2 flow described in https://rebel-guy.atlassian.net/browse/CHAT-378?focusedCommentId=10079
    // todo: must return streamerId
    return []

    // todo: will need to implement pagination in the future, but will work just fine for low volumes of data
    const params: Stringify<GetDonationsRequestParams> = {
      limit: '100',
      verified: this.nodeEnv === 'release' ? '1' : '0',
      after: id == null ? undefined : `${id}`
    }
    const donations = await this.makeRequest<GetDonationsResponse>('GET', '/donations', new URLSearchParams(params))

    return donations.data.map(d => ({
      streamlabsUserId: null,
      amount: Number.parseFloat(d.amount),
      formattedAmount: d.amount,
      createdAt: Number.parseInt(d.created_at),
      currency: d.currency as CurrencyCode,
      donationId: Number.parseInt(d.donation_id),
      message: d.message,
      name: d.name
    }))
  }

  public setDonationCallback (callback: DonationCallback) {
    if (this.donationCallback != null) {
      throw new Error('Already listening')
    }

    this.donationCallback = callback
  }

  public listenToStreamerDonations (streamerId: number, socketToken: string) {
    const adapter: WebsocketAdapter<WebsocketMessage> = {
      onMessage: (data: WebsocketMessage) => this.onSocketData(streamerId, data),
      onConnect: () => this.logService.logInfo(this, `Donation WebSocket for streamer ${streamerId} connected`),
      onDisconnect: (reason: DisconnectReason) => this.logService.logInfo(this, `Donation WebSocket for streamer ${streamerId} disconnected. Reason:`, reason),
      onError: (e: any) => this.logService.logInfo(this, `Donation WebSocket for streamer ${streamerId} encountered an error:`, e.message)
    }
    const options: SocketIOClient.ConnectOpts = {
      reconnection: true,
      reconnectionDelay: 10000,
      autoConnect: false
    }
    const webSocket = this.websocketFactory.create(`${SOCKET_BASE_URL}?token=${socketToken}`, adapter, options)
    webSocket.connect()

    this.streamerWebSockets.set(streamerId, webSocket)
  }

  public stopListeningToStreamerDonations (streamerId: number) {
    if (this.streamerWebSockets.has(streamerId)) {
      this.streamerWebSockets.get(streamerId)!.disconnect()
      this.streamerWebSockets.delete(streamerId)
    }
  }

  public getWebsocket (streamerId: number): SocketIOClient.Socket | null {
    return this.streamerWebSockets.get(streamerId) ?? null
  }

  private onSocketData = async (streamerId: number, data: WebsocketMessage) => {
    this.logService.logDebug(this, 'WebSocket received data:', data)
    if (data.type !== 'donation') {
      return
    }

    const message = single(data.message)
    const donation: StreamlabsDonation = {
      donationId: message.id,
      streamlabsUserId: message.from_user_id ?? null,
      amount: Number.parseFloat(message.amount),
      formattedAmount: message.formattedAmount,
      createdAt: new Date().getTime(),
      currency: message.currency,
      message: message.message,
      name: message.from
    }

    try {
      await this.donationCallback!(donation, streamerId)
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
