import ChatMateManager from '@rebel/studio/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/CustomEmojiManager'
import Home from '@rebel/studio/Home'
import HomePageButton from '@rebel/studio/HomePageButton'
import { Page } from '@rebel/studio/types'
import React from 'react'
import './App.css'

type Props = {}

type State = {
  currentPage: Page
}

export default class App extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentPage: 'home'
    }
  }

  onSelectPage = (page: Page) => {
    this.setState({ currentPage: page })
  }

  onSelectHomePage = () => {
    this.setState({ currentPage: 'home' })
  }

  override render () {
    return (
      <div className="App">
        <h1>ChatMate Studio</h1>
        {this.state.currentPage !== 'home' && <HomePageButton onHome={this.onSelectHomePage} />}
        {this.state.currentPage === 'home' && <Home onSelectPage={this.onSelectPage} />} 
        {this.state.currentPage === 'chatMate' && <ChatMateManager />}
        {this.state.currentPage === 'customEmoji' && <CustomEmojiManager />}
      </div>
    )
  }
}
