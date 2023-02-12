import Factory from '@rebel/shared/Factory'

// we have to use this ancient version thanks to the fantastic work of the streamlabs devs!
// https://stackoverflow.com/a/67447804
import io from 'socket.io-client'

export type DisconnectReason = 'transport close' | 'ping timeout' | 'transport error' | string

export type WebsocketAdapter<TMessage> = {
  onMessage?: (message: TMessage) => void | Promise<void>
  onConnect?: () => void | Promise<void>
  onDisconnect?: (reason: DisconnectReason) => void | Promise<void>
  onError?: (e: any) => void | Promise<void>
}

export default class WebsocketFactory extends Factory<SocketIOClient.Socket> {
  constructor () {
    super(null)
  }

  /** Does not automatically connect. */
  public override create (uri: string, websocketAdapter: WebsocketAdapter<any>, options?: SocketIOClient.ConnectOpts): SocketIOClient.Socket {
    const webSocket = io(uri, options)

    if (websocketAdapter.onMessage != null) {
      webSocket.on('event', websocketAdapter.onMessage)
    }

    if (websocketAdapter.onConnect != null) {
      webSocket.on('connect', websocketAdapter.onConnect)
    }

    if (websocketAdapter.onDisconnect != null) {
      webSocket.on('disconnect', websocketAdapter.onDisconnect)
    }

    if (websocketAdapter.onError != null) {
      webSocket.on('connect_error', websocketAdapter.onError)
    }

    return webSocket
  }
}
