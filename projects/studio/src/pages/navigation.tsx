import ApplyForStreamer from '@rebel/studio/pages/apply/ApplyForStreamer'
import ChatMateManager from '@rebel/studio/pages/manager/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/pages/emojis/CustomEmojiManager'
import LinkUser from '@rebel/studio/pages/link/LinkUser'
import LoginForm from '@rebel/studio/pages/login/LoginForm'
import React from 'react'
import Home from '@rebel/studio/pages/home/Home'
import { AccountCircle, Camera, Home as HomeIcon, Link, Mood, Settings, StarBorder } from '@mui/icons-material'
import TwitchAdminLogin from '@rebel/studio/pages/admin/twitch/TwitchAdminLogin'
import { Props as RequireRankProps } from '@rebel/studio/components/RequireRank'

export type Page = {
  id: string
  title: string
  element: React.ReactElement
  icon: React.ReactElement
  path: string
  requireRanksProps: Omit<RequireRankProps, 'children' | 'hideAdminOutline'> | null
}

// by typing out pages as `const`s, we can enforce the required route parameters to be provided when generating paths (via `generatePath`)
export const PageHome = {
  id: 'home',
  title: 'Home',
  element: <Home />,
  icon: <HomeIcon />,
  path: '/',
  requireRanksProps: null
} as const

export const PageEmojis = {
  id: 'emojis',
  title: 'Emojis',
  element: <CustomEmojiManager />,
  icon: <Mood />,
  path: '/:streamer/emojis',
  requireRanksProps: null
} as const

export const PageApply = {
  id: 'apply',
  title: 'ChatMate Beta Program',
  element: <ApplyForStreamer />,
  icon: <StarBorder />,
  path: '/apply',
  requireRanksProps: { admin: true }
} as const

export const PageLogin = {
  id: 'login',
  title: 'Login',
  element: <LoginForm />,
  icon: <AccountCircle />,
  path: '/login',
  requireRanksProps: null
} as const

export const PageLink = {
  id: 'link',
  title: 'Link Channels',
  element: <LinkUser />,
  icon: <Link />,
  path: '/link',
  requireRanksProps: null
} as const

export const PageManager = {
  id: 'manager',
  title: 'Stream Manager',
  element: <ChatMateManager />,
  icon: <Settings />,
  path: '/manager',
  requireRanksProps: { anyOwner: true }
} as const

export const PageTwitchAuth = {
  id: 'twitch',
  title: 'Twitch Admin Login',
  element: <TwitchAdminLogin />,
  icon: <Camera />,
  // don't change this path without also updating AdminService
  path: '/admin/twitch',
  requireRanksProps: { admin: true }
} as const

export const pages: ReadonlyArray<Page> = [PageHome, PageEmojis, PageApply, PageLogin, PageLink, PageManager, PageTwitchAuth]
