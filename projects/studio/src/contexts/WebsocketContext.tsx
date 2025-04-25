import { SERVER_URL } from '@rebel/studio/utility/global'
import React, { useState, useEffect } from 'react'

const WEBSOCKET_URI = `${SERVER_URL.replace('http', 'ws')}/ws`

function createWebsocket () {
  const websocket = new WebSocket(WEBSOCKET_URI)

  websocket.addEventListener('open', (ev) => {
    console.log(new Date().toLocaleString(), 'Connected to the Websocket', ev)
  })

  websocket.addEventListener('close', (ev) => {
    console.log(new Date().toLocaleString(), 'Disconnected from the Websocket', ev)
  })

  websocket.addEventListener('error', (ev) => {
    console.error(new Date().toLocaleString(), 'Encountered error', ev)
  })

  return websocket
}

type Props = {
  children: React.ReactNode
}

type WebSocketState = 'changing' | 'connected' | 'disconnected'

export function WebsocketProvider (props: Props) {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [websocketState, setWebsocketState] = useState<WebSocketState>('disconnected')

  useEffect(() => {
    if (websocket == null || websocketState === 'disconnected') {
      const newWebsocket = createWebsocket()
      setWebsocketState('changing')
      setWebsocket(newWebsocket)
      newWebsocket.addEventListener('open', () => setWebsocketState('connected'))
      newWebsocket.addEventListener('close', () => setWebsocketState('disconnected'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websocketState])

  return (
    <WebsocketContext.Provider
      value={{
        websocket: websocket!,
        state: websocketState
      }}
    >
      {props.children}
    </WebsocketContext.Provider>
  )
}

type WebsocketContextType = {
  websocket: WebSocket
  state: WebSocketState
}

const WebsocketContext = React.createContext<WebsocketContextType>(null!)
export default WebsocketContext
