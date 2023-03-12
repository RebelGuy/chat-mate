import ApplyForStreamer from '@rebel/studio/pages/apply/ApplyForStreamer'
import ChatMateManager from '@rebel/studio/pages/manager/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/pages/emojis/CustomEmojiManager'
import LinkUser from '@rebel/studio/pages/link/LinkUser'
import LoginForm from '@rebel/studio/pages/login/LoginForm'
import React from 'react'
import Home from '@rebel/studio/pages/home/Home'

export type Page = {
  id: string
  title: string
  element: React.ReactElement
  path: string
}

// by typing out pages as `const`s, we can enforce the required route parameters to be provided when generating paths (via `generatePath`)
export const PageHome = {
  id: 'home',
  title: 'Home',
  element: <Home />,
  path: '/'
} as const

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

export const PageManager = {
  id: 'manager',
  title: 'ChatMate Manager',
  element: <ChatMateManager />,
  path: '/manager'
} as const

export const pages: ReadonlyArray<Page> = [PageHome, PageEmojis, PageApply, PageLogin, PageLink, PageManager]
