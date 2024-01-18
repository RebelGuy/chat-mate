import LogService from '@rebel/server/services/LogService'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  logService: LogService
  channelStore: ChannelStore
  externalRankEventService: ExternalRankEventService
}>

export default class ChannelEventService extends ContextClass {
  public readonly name = ChannelEventService.name

  private readonly logService: LogService
  private readonly channelStore: ChannelStore
  private readonly externalRankEventService: ExternalRankEventService

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.channelStore = deps.resolve('channelStore')
    this.externalRankEventService = deps.resolve('externalRankEventService')
  }

  /** Checks if the user's external rank has changed and, if so, syncs the mod rank. On Twitch, we do this by listening to mod/unmod events. On Youtube, this method is the equivalent. */
  public async checkYoutubeChannelForModEvent (streamerId: number, youtubeChannelId: number) {
    return // waiting for CHAT-718, otherwise we will have major issues lol. once you remove this, ensure you enable the tests again

    const infos = await this.channelStore.getYoutubeChannelHistory(streamerId, youtubeChannelId, 2)
    if (infos.length < 2) {
      return
    }

    const [info1, info2] = infos
    if (info1.isModerator === info2.isModerator) {
      return
    }

    const isMod = info1.isModerator
    this.logService.logInfo(this, `Based on the latest two Youtube channel info for channel ${youtubeChannelId} in streamer ${streamerId}, the channel has been ${isMod ? 'modded' : 'unmodded'}. Notifying ${ExternalRankEventService.name}.`)
    if (isMod) {
      await this.externalRankEventService.onYoutubeChannelModded(streamerId, youtubeChannelId)
    } else {
      await this.externalRankEventService.onYoutubeChannelUnmodded(streamerId, youtubeChannelId)
    }
  }
}
