import LogSummary from '@rebel/studio/LogSummary'
import { Page } from '@rebel/studio/types'

type Props = {
  onSelectPage: (page: Page) => void
}

export default function Home (props: Props) {
  return (
    <div>
      <LogSummary />
      <button onClick={() => props.onSelectPage('customEmoji')} style={{ display: 'block', margin: 'auto' }}>Custom Emoji Manager</button>
      <button onClick={() => props.onSelectPage('chatMate')} style={{ display: 'block', margin: 'auto' }}>ChatMate Manager</button>
    </div>
  )
}