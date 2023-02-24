import ApplyForStreamer from '@rebel/studio/ApplyForStreamer'
import ChatMateManager from '@rebel/studio/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/CustomEmojiManager'
import LinkUser from '@rebel/studio/LinkUser'
import LoginForm from '@rebel/studio/LoginForm'
import LoginProvider from '@rebel/studio/contexts/LoginProvider'
import RegistrationForm from '@rebel/studio/RegistrationForm'
import { Route, Routes } from 'react-router-dom'
import MainView from '@rebel/studio/MainView'

export default function App () {
  return (
    <LoginProvider>
      <Routes>
        <Route path="/" element={<MainView />}>
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/manager" element={<ChatMateManager />} />
          <Route path="/emojis" element={<CustomEmojiManager />} />
          <Route path="/apply" element={<ApplyForStreamer />} />
          <Route path="/link" element={<LinkUser />} />
        </Route>
      </Routes>
    </LoginProvider>
  )
}
