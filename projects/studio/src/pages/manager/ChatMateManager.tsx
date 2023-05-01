import StreamlabsWebsocketForm from '@rebel/studio/pages/manager/StreamlabsWebsocketForm'
import TwitchEventStatuses from '@rebel/studio/pages/manager/TwitchEventStatuses'
import YoutubeLivestreamForm from '@rebel/studio/pages/manager/YoutubeLivestreamForm'
import YoutubeStatus from '@rebel/studio/pages/manager/YoutubeStatus'

export default function ChatMateManager () {
  return <div style={{ display: 'block' }}>
    <YoutubeLivestreamForm />
    <StreamlabsWebsocketForm />
    <YoutubeStatus />
    <TwitchEventStatuses />
  </div>
}
