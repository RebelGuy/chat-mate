// https://www.electronjs.org/docs/api/session
import { Dependencies } from '@rebel/shared/context/context'
import DbProvider from '@rebel/server/providers/DbProvider'
import { CHANNEL_ID, DB, DB_PROVIDER } from '@rebel/server/scripts/consts'
import AuthStore from '@rebel/server/stores/AuthStore'
import { app, BrowserWindow } from 'electron'
import { ChatMateError } from '@rebel/shared/util/error'

const isSingleInstance = app.requestSingleInstanceLock()

if (!isSingleInstance) {
  app.quit()
  process.exit(0)
}

// NOTE: why tho?
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

async function createWindow () {
  mainWindow = new BrowserWindow({
    show: false, // Use 'ready-to-show' event to show window
    webPreferences: {
      center: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    } as any,
  })

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  mainWindow.webContents.on('did-finish-load', async (e: any) => {
    const url = e.sender.getURL()
    if (url === 'https://www.youtube.com/account_advanced') {
      const match = await mainWindow!.webContents.executeJavaScript(
        '/ytcfg\\.set\\(({.+?})\\);/.exec(document.head.innerHTML)',
        true
      )
      const sessionId = match
        ? JSON.parse(match[1])['DELEGATED_SESSION_ID']
        : undefined

      const ses = e.sender.session
      const cookies = await ses.cookies.get({})
      const creds = Object.fromEntries(
        cookies
          .filter((cookie: any) =>
            ['APISID', 'HSID', 'SAPISID', 'SID', 'SSID'].includes(cookie.name)
          )
          .map((cookie: any) => [cookie.name, cookie.value])
      )

      const accessToken = Buffer.from(JSON.stringify({ ...creds, DELEGATED_SESSION_ID: sessionId })).toString('base64')
      console.log('Successfully retrieved the access token from the response.')

      let channelId: string
      try {
        const channelUrl = await mainWindow!.webContents.executeJavaScript(`
          // wait for the dom to update
          new Promise(resolve => setTimeout(resolve, 500))
            .then(() => {
              // this element is now available
              return document.querySelectorAll("[id='share-url']")[1].value
            })
        `)
        if (channelUrl == null) {
          throw new ChatMateError('ChannelUrl was null')
        }

        channelId = channelUrl.split('/').at(-1)
        if (channelId.length !== 24) {
          throw new ChatMateError(`Invalid channelId: ${channelId} (from URL ${channelUrl})`)
        }
        console.log(`Successfully retrieved channel ID ${channelId} from the Youtube page.`)

        if (channelId !== CHANNEL_ID) {
          throw new ChatMateError(`Expected a channel ID of ${CHANNEL_ID}. Please ensure you are logged into the correct YouTube account.`)
        }
      } catch (ex: any) {
        console.error('Failed to complete YouTube auth.', ex)
        app.quit()
        return
      }

      const authStore = new AuthStore(new Dependencies({
        dbProvider: DB_PROVIDER,
        twitchClientId: ''
      }))
      await authStore.saveYoutubeWebAccessToken(channelId, accessToken)

      console.log('-------------------')
      console.log('Successfully saved YouTube credentials.')
      console.log('-------------------')

      app.quit()
    }
  })

  await mainWindow.loadURL(
    'https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https://www.youtube.com/account_advanced',
    { userAgent: 'Chrome' }
  )
}

app.on('session-created', (session) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  session.clearStorageData()
})

app.on('second-instance', () => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app
  .whenReady()
  .then(createWindow)
  .catch((e) => console.error('Failed create window:', e))
