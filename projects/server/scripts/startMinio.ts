import { spawn, exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { MINIO_PATH } from '@rebel/server/scripts/consts'

if (!fs.existsSync(MINIO_PATH)) {
  throw new Error(`MinIO could not be found at '${MINIO_PATH}'`)
}

const pidFile = path.join(__dirname, 'minio.pid')

async function isMinIORunning (): Promise<boolean> {
  if (!fs.existsSync(pidFile)) {
    return false
  }

  // read the pid and check if the process is running
  const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'))
  return new Promise(res => {
    exec(`ps -p ${pid} -o cmd=`, (err, stdout) => {
      if (err) {
        res(false)
      } else {
        res(stdout.length > 0)
      }
    })
  })
}

// start minIO and keep it running
async function main () {
  const isRunning = await isMinIORunning()
  if (isRunning) {
    console.log('MinIO is already running')
    return
  }

  const minio = spawn(MINIO_PATH, ['server', '../../data/minio'], {
    stdio: 'inherit',
    shell: true,
  })

  // this would run minio independently, i.e. the process would persist even after chatmate shuts down
  // const minio = spawn(MINIO_PATH, ['server', 'data'], {
  //   stdio: 'ignore',
  //   detached: true,
  // })
  // minio.unref()

  console.log(`MinIO started (process ${minio.pid})`)

  fs.writeFileSync(pidFile, minio.pid!.toString())
}

void main()
