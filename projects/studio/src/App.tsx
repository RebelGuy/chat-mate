import ChatMateManager from '@rebel/studio/ChatMateManager'
import React from 'react'
import './App.css'
import CustomEmojiManager from './CustomEmojiManager'

type Props = {}

type State = {
  currentPage: null | 'customEmoji' | 'chatMate'
}

export default class App extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentPage: null
    }
  }

  onSelectChatMatePage = () => {
    this.setState({ currentPage: 'chatMate' })
  }

  onSelectCustomEmojiPage = () => {
    this.setState({ currentPage: 'customEmoji' })
  }

  override render () {
    return (
      <div className="App">
        <h1>ChatMate Studio</h1>
        {this.state.currentPage === null && <div>
          <button onClick={this.onSelectCustomEmojiPage} style={{ display: 'block', margin: 'auto' }}>Custom Emoji Manager</button>
          <button onClick={this.onSelectChatMatePage} style={{ display: 'block', margin: 'auto' }}>ChatMate Manager</button>
        </div>}
        {this.state.currentPage === 'chatMate' && <ChatMateManager />}
        {this.state.currentPage === 'customEmoji' && <CustomEmojiManager />}
      </div>
    )
  }
}
