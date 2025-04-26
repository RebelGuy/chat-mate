import ApplyForStreamer from '@rebel/studio/pages/apply/ApplyForStreamer'
import ChatMateManager from '@rebel/studio/pages/manager/ChatMateManager'
import CustomEmojiManager from '@rebel/studio/pages/emojis/CustomEmojiManager'
import LinkUser from '@rebel/studio/pages/link/LinkUser'
import LoginForm from '@rebel/studio/pages/login/LoginForm'
import React from 'react'
import Home from '@rebel/studio/pages/home/Home'
import { AccountCircle, Camera, Home as HomeIcon, Link, Mood, Security, Settings, StarBorder, Videocam } from '@mui/icons-material'
import TwitchAdminLogin from '@rebel/studio/pages/admin/twitch/TwitchAdminLogin'
import { Props as RequireRankProps } from '@rebel/studio/components/RequireRank'
import StreamerInfo from '@rebel/studio/pages/streamer-info/StreamerInfo'
import YouTube from '@rebel/studio/icons/YouTube'
import YoutubeAdminLogin from '@rebel/studio/pages/admin/youtube/YoutubeAdminLogin'
import ResetPasswordForm from '@rebel/studio/pages/login/ResetPasswordForm'
import { SafeOmit } from '@rebel/shared/types'
import TasksPage from '@rebel/studio/pages/admin/task/TasksPage'

export type Page = {
  id: string
  title: string
  element: React.ReactElement
  icon: React.ReactElement
  path: string
  requiresLogin: boolean
  requiresStreamer: boolean
  requireRanksProps: SafeOmit<RequireRankProps, 'children' | 'hideAdminOutline'> | null
}

// by typing out pages as `const`s, we can enforce the required route parameters to be provided when generating paths (via `generatePath`)
export const PageHome = {
  id: 'home',
  title: 'Home',
  element: <Home />,
  icon: <HomeIcon />,
  path: '/',
  requiresLogin: false,
  requiresStreamer: false,
  requireRanksProps: null
} as const

export const PageEmojis = {
  id: 'emojis',
  title: 'Emojis',
  element: <CustomEmojiManager />,
  icon: <Mood />,
  path: '/:streamer/emojis',
  requiresLogin: false,
  requiresStreamer: true,
  requireRanksProps: null
} as const

export const PageApply = {
  id: 'apply',
  title: 'ChatMate Beta Program',
  element: <ApplyForStreamer />,
  icon: <StarBorder />,
  path: '/apply',
  requiresLogin: true,
  requiresStreamer: false,
  requireRanksProps: null
} as const

export const PageLogin = {
  id: 'login',
  title: 'Login',
  element: <LoginForm />,
  icon: <AccountCircle />,
  path: '/login',
  requiresLogin: false,
  requiresStreamer: false,
  requireRanksProps: null
} as const

export const PageChangePassword = {
  id: 'changePassword',
  title: 'Change Password',
  element: <ResetPasswordForm />,
  icon: <AccountCircle />,
  path: '/changePassword',
  requiresLogin: true,
  requiresStreamer: false,
  requireRanksProps: null
} as const

export const PageLink = {
  id: 'link',
  title: 'Link Channels',
  element: <LinkUser />,
  icon: <Link />,
  path: '/link',
  requiresLogin: true,
  requiresStreamer: false,
  requireRanksProps: null
} as const

export const PageStreamerInfo = {
  id: 'streamerInfo',
  title: 'Streamer Info',
  element: <StreamerInfo />,
  icon: <Videocam />,
  path: '/:streamer/info',
  requiresLogin: false,
  requiresStreamer: true,
  requireRanksProps: null
} as const

export const PageManager = {
  id: 'manager',
  title: 'Stream Manager',
  element: <ChatMateManager />,
  icon: <Settings />,
  // don't change this path without also updating StreamerService and application redirect URLs
  path: '/manager',
  requiresLogin: true,
  requiresStreamer: false,
  requireRanksProps: { anyOwner: true }
} as const

export const PageTwitchAuth = {
  id: 'twitch',
  title: 'Twitch Admin Login',
  element: <TwitchAdminLogin />,
  icon: <Camera />,
  // don't change this path without also updating AdminService and application redirect URLs
  path: '/admin/twitch',
  requiresLogin: true,
  requiresStreamer: false,
  requireRanksProps: { admin: true }
} as const

export const PageYoutubeAuth = {
  id: 'youtube',
  title: 'Youtube Admin Login',
  element: <YoutubeAdminLogin />,
  icon: <YouTube />,
  // don't change this path without also updating AdminService and application redirect URLs
  path: '/admin/youtube',
  requiresLogin: true,
  requiresStreamer: false,
  requireRanksProps: { admin: true }
} as const

export const PageTask = {
  id: 'task',
  title: 'Tasks',
  element: <TasksPage />,
  icon: <Security />,
  path: '/admin/task',
  requiresLogin: true,
  requiresStreamer: false,
  requireRanksProps: { admin: true }
} as const

export const pages: ReadonlyArray<Page> = [PageHome, PageEmojis, PageApply, PageLogin, PageChangePassword, PageLink, PageStreamerInfo, PageManager, PageTwitchAuth, PageYoutubeAuth, PageTask]
