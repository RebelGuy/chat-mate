import ApplyForStreamer from '@rebel/studio/ApplyForStreamer'
import ChatMateManager from '@rebel/studio/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/CustomEmojiManager'
import LinkUser from '@rebel/studio/LinkUser'
import LoginForm from '@rebel/studio/LoginForm'
import RegistrationForm from '@rebel/studio/RegistrationForm'
import React from 'react'

type Page = {
  id: string
  title: string
  element: React.ReactElement
  path: `/${string}`
}

// by typing out pages as `const`s, we can enforce the required route parameters to be provided when generating paths (via `generatePath`)
export const PageEmojis = {
  id: 'emojis',
  title: 'Emoji Manager',
  element: <CustomEmojiManager />,
  path: '/:streamer/emojis'
} as const

export const PageApply = {
  id: 'apply',
  title: 'ChatMate Beta Program',
  element: <ApplyForStreamer />,
  path: '/apply'
} as const

export const PageRegister = {
  id: 'register',
  title: 'Register',
  element: <RegistrationForm />,
  path: '/register'
} as const

export const PageLogin = {
  id: 'login',
  title: 'Login',
  element: <LoginForm />,
  path: '/login'
} as const

export const PageLink = {
  id: 'link',
  title: 'Link Channels',
  element: <LinkUser />,
  path: '/link'
} as const

export const PageChatMateManager = {
  id: 'manager',
  title: 'ChatMate Manager',
  element: <ChatMateManager />,
  path: '/manager'
} as const

export const pages: ReadonlyArray<Page> = [PageEmojis, PageApply, PageRegister, PageLogin, PageLink, PageChatMateManager]
