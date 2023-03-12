import ApplyForStreamer from '@rebel/studio/pages/apply/ApplyForStreamer'
import ChatMateManager from '@rebel/studio/pages/manager/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/pages/emojis/CustomEmojiManager'
import LinkUser from '@rebel/studio/pages/link/LinkUser'
import LoginForm from '@rebel/studio/pages/login/LoginForm'
import React from 'react'
import Home from '@rebel/studio/pages/home/Home'
import { AccountCircle, Home as HomeIcon, Link, Mood, Settings, StarBorder } from '@mui/icons-material'

export type Page = {
  id: string
  title: string
  element: React.ReactElement
  icon: React.ReactElement
  path: string
}

// by typing out pages as `const`s, we can enforce the required route parameters to be provided when generating paths (via `generatePath`)
export const PageHome = {
  id: 'home',
  title: 'Home',
  element: <Home />,
  icon: <HomeIcon />,
  path: '/'
} as const

export const PageEmojis = {
  id: 'emojis',
  title: 'Emoji Manager',
  element: <CustomEmojiManager />,
  icon: <Mood />,
  path: '/:streamer/emojis'
} as const

export const PageApply = {
  id: 'apply',
  title: 'ChatMate Beta Program',
  element: <ApplyForStreamer />,
  icon: <StarBorder />,
  path: '/apply'
} as const

export const PageLogin = {
  id: 'login',
  title: 'Login',
  element: <LoginForm />,
  icon: <AccountCircle />,
  path: '/login'
} as const

export const PageLink = {
  id: 'link',
  title: 'Link Channels',
  element: <LinkUser />,
  icon: <Link />,
  path: '/link'
} as const

export const PageManager = {
  id: 'manager',
  title: 'ChatMate Manager',
  element: <ChatMateManager />,
  icon: <Settings />,
  path: '/manager'
} as const

export const pages: ReadonlyArray<Page> = [PageHome, PageEmojis, PageApply, PageLogin, PageLink, PageManager]
