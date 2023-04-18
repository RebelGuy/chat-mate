import StreamlabsWebsocketForm from '@rebel/studio/pages/manager/StreamlabsWebsocketForm'
import TwitchEventStatuses from '@rebel/studio/pages/manager/TwitchEventStatuses'
import YoutubeLivestreamForm from '@rebel/studio/pages/manager/YoutubeLivestreamForm'

export default function ChatMateManager () {
  return <div style={{ display: 'block' }}>
    <YoutubeLivestreamForm />
    <StreamlabsWebsocketForm />
    <TwitchEventStatuses />
  </div>
}
