import React from 'react'
import './App.css'
import CustomEmojiManager from './CustomEmojiManager'

type Props = {}

type State = {
  currentPage: null | 'customEmoji'
}

export default class App extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentPage: null
    }
  }

  onSelectCustomEmojiPage = () => {
    this.setState({ currentPage: 'customEmoji' })
  }

  override render () {
    return (
      <div className="App">
        <h1>ChatMate Studio</h1>
        {this.state.currentPage === null && <button onClick={this.onSelectCustomEmojiPage}>Custom Emoji Manager</button>}
        {this.state.currentPage === 'customEmoji' && <CustomEmojiManager />}
      </div>
    )
  }
}
