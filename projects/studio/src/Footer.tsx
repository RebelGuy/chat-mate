import { SERVER_URL } from '@rebel/studio/global'

export default function Footer () {
  return (
    <footer style={{ position: 'fixed', bottom: 0, padding: 8 }}>
      <a href={SERVER_URL}>Server</a>
    </footer>
  )
}
