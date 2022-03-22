/* eslint-disable @typescript-eslint/quotes */
// https://www.electronjs.org/docs/api/session

import { app, BrowserWindow } from 'electron'
import { URL } from 'url'
import fetch from 'node-fetch'


// stolen from the masterchat auth fetcher, modified according to https://twurple.js.org/docs/examples/chat/basic-bot.html

const REDIRECT_URI = 'http://localhost'
const CLIENT_ID = process.env.TWITCH_CLIENT_ID
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET

if (REDIRECT_URI == null || CLIENT_ID == null || CLIENT_SECRET == null) {
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
    } as any,
  })

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
  mainWindow.on("ready-to-show", () => {
    mainWindow!.show()
    mainWindow!.webContents.openDevTools()
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  mainWindow.webContents.on("did-finish-load", async (e: any) => {
    //
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  mainWindow.webContents.on('update-target-url', async (e: any) => {

    const url = e.sender.getURL() as string
    if (url.startsWith(REDIRECT_URI)) {

      // we got redirected to our localhost, with a `code` query parameter
      const CODE = new URL(url).searchParams.get('code')

      const authUrl = `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${CODE}&grant_type=authorization_code&redirect_uri=${REDIRECT_URI}`
      const rawResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      })
      const response = await rawResponse.json() as any

      console.log('----- SUCCESS -----')
      console.log(`Copy the following variables to the ${process.env.NODE_ENV?.toLowerCase()}.env file:`)
      console.log('')
      console.log(`TWITCH_ACCESS_TOKEN=${response.access_token}`)
      console.log(`TWITCH_REFRESH_TOKEN=${response.refresh_token}`)
      console.log('')
      console.log('-------------------')
       
      app.quit()
    }
  })

  await mainWindow.loadURL(`https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=chat:read+chat:edit`)
}

app.on("session-created", (session: any) => {
  session.clearStorageData()
})

app.on("second-instance", () => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app
  .whenReady()
  .then(createWindow)
  .catch((e) => console.error("Failed create window:", e))
