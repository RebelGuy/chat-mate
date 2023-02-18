// https://www.electronjs.org/docs/api/session
import { app, BrowserWindow } from 'electron'
import { URL } from 'url'
import fetch from 'node-fetch'
import { TWITCH_SCOPE } from '@rebel/server/providers/TwurpleAuthProvider'
import { DB, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from '@rebel/server/scripts/consts'
import AuthStore from '@rebel/server/stores/AuthStore'
import DbProvider from '@rebel/server/providers/DbProvider'
import { Dependencies } from '@rebel/shared/context/context'
import { AccessToken } from '@twurple/auth/lib'


// stolen from the masterchat auth fetcher, modified according to https://twurple.js.org/docs/examples/chat/basic-bot.html

const REDIRECT_URI = 'http://localhost'

if (REDIRECT_URI == null || TWITCH_CLIENT_ID == null || TWITCH_CLIENT_SECRET == null) {
  throw new Error('Invalid env variables')
}


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
    } as any
  })

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    mainWindow!.webContents.openDevTools()
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  mainWindow.webContents.on('did-finish-load', async (e: any) => {
    //
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  mainWindow.webContents.on('update-target-url', async (e: any) => {

    const url = e.sender.getURL() as string
    if (url.startsWith(REDIRECT_URI)) {

      // we got redirected to our localhost, with a `code` query parameter
      const CODE = new URL(url).searchParams.get('code')

      const authUrl = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&code=${CODE}&grant_type=authorization_code&redirect_uri=${REDIRECT_URI}`
      const rawResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      })
      const response = await rawResponse.json() as any
      const accessToken = response.access_token
      const refreshToken = response.refresh_token

      console.log('Successfully retrieved the access token from the response.')

      const partialDbProvider: Pick<DbProvider, 'get'> = { get: () => DB }
      const authStore = new AuthStore(new Dependencies({
        dbProvider: partialDbProvider as DbProvider,
        twitchClientId: TWITCH_CLIENT_ID
      }))
      const token: AccessToken = {
        accessToken,
        refreshToken,
        scope: TWITCH_SCOPE,
        expiresIn: 0,
        obtainmentTimestamp: 0
      }
      await authStore.saveTwitchAccessToken(token)

      console.log('-------------------')
      console.log('Successfully saved Twitch credentials.')
      console.log('-------------------')

      app.quit()
    }
  })

  const scope = TWITCH_SCOPE.join('+')
  await mainWindow.loadURL(`https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scope}`)
}

app.on('session-created', (session: any) => {
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
