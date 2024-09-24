import { exec } from 'child_process'

exec('pkill -f "minio server"', (err) => {
  if (err) {
    console.error('MinIO was not running')
  } else {
    console.log('MinIO stopped')
  }
})
