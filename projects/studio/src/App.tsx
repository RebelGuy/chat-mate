import ChatMateManager from '@rebel/studio/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/CustomEmojiManager'
import DebugInfo from '@rebel/studio/DebugInfo'
import Home from '@rebel/studio/Home'
import HomePageButton from '@rebel/studio/HomePageButton'
import LoginForm from '@rebel/studio/LoginForm'
import LoginProvider from '@rebel/studio/LoginProvider'
import RegistrationForm from '@rebel/studio/RegistrationForm'
import { Page } from '@rebel/studio/types'
import * as React from 'react'
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

  onSelectRegistrationPage = () => {
    this.setState({ currentPage: 'registration' })
  }

  override render () {
    return (
      <div className="App">
        <LoginProvider >
          <DebugInfo />
          <h1>ChatMate Studio</h1>
          {this.state.currentPage !== 'home' && <HomePageButton onHome={this.onSelectHomePage} />}
          {this.state.currentPage === 'home' && <Home onSelectPage={this.onSelectPage} />}
          {this.state.currentPage === 'registration' && <RegistrationForm onBack={this.onSelectHomePage} />}
          {this.state.currentPage === 'login' && <LoginForm onBack={this.onSelectHomePage} onRegister={this.onSelectRegistrationPage} />}
          {this.state.currentPage === 'chatMate' && <ChatMateManager />}
          {this.state.currentPage === 'customEmoji' && <CustomEmojiManager />}
        </LoginProvider>
      </div>
    )
  }
}
