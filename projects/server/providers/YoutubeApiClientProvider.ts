import { youtube, youtube_v3 } from '@googleapis/youtube'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  youtubeAuthProvider: YoutubeAuthProvider
}>

export class YoutubeApiClientProvider extends ContextClass {
  private readonly youtubeAuthProvider: YoutubeAuthProvider

  constructor (deps: Deps) {
    super()
    this.youtubeAuthProvider = deps.resolve('youtubeAuthProvider')
  }

  public async getClientForAdmin (): Promise<youtube_v3.Youtube> {
    const auth = await this.youtubeAuthProvider.getAuth('admin')
    return youtube({
      version: 'v3',
      auth: auth
    })
  }

  public async getClientForStreamer (externalChannelId: string): Promise<youtube_v3.Youtube> {
    const auth = await this.youtubeAuthProvider.getAuth(externalChannelId)
    return youtube({
      version: 'v3',
      auth: auth
    })
  }
}
