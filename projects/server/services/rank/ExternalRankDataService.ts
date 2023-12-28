import { RankGroup } from '@prisma/client'
import { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ChannelService, { ExternalRankEventData, isTwitchChannel } from '@rebel/server/services/ChannelService'
import LogService from '@rebel/server/services/LogService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import RankStore from '@rebel/server/stores/RankStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { single } from '@rebel/shared/util/arrays'

type Deps = Dependencies<{
  channelStore: ChannelStore
  channelService: ChannelService
  logService: LogService
  rankStore: RankStore
}>

export default class ExternalRankDataService extends ContextClass {
  public readonly name = ExternalRankDataService.name

  private readonly channelStore: ChannelStore
  private readonly channelService: ChannelService
  private readonly logService: LogService
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super()
    this.channelStore = deps.resolve('channelStore')
    this.channelService = deps.resolve('channelService')
    this.logService = deps.resolve('logService')
    this.rankStore = deps.resolve('rankStore')
  }

  /** Transforms data of the rank event into the internal data types. */
  public async getTwitchDataForExternalRankEvent (streamerId: number, channelName: string, moderatorChannelName: string | null, getRanksForGroup: RankGroup): Promise<ExternalRankEventData | null> {
    const channel = await this.channelStore.getChannelFromUserNameOrExternalId(channelName)
    if (channel == null || !isTwitchChannel(channel)) {
      return null
    }

    const userChannel = await this.channelStore.getTwitchChannelsFromChannelIds([channel.id]).then(single)
    const primaryUserId = getPrimaryUserId(userChannel)
    const channelId = userChannel.platformInfo.channel.id

    const ranks = await this.rankStore.getUserRanksForGroup(getRanksForGroup, streamerId)
    const punishmentRanksForUser = ranks.filter(r => r.primaryUserId === primaryUserId)

    const moderatorChannel = moderatorChannelName != null ? await this.channelStore.getChannelFromUserNameOrExternalId(moderatorChannelName) : null
    const moderatorUserChannel = moderatorChannel != null && isTwitchChannel(moderatorChannel) ? await this.channelStore.getTwitchChannelsFromChannelIds([moderatorChannel.id]).then(single) : null
    const moderatorPrimaryUserId = moderatorUserChannel != null ? getPrimaryUserId(moderatorUserChannel) : null

    return { primaryUserId, channelId, ranksForUser: punishmentRanksForUser, moderatorPrimaryUserId }
  }

  /** Transforms data of the rank event into the internal data types. */
  public async getYoutubeDataForExternalRankEvent (streamerId: number, channelName: string, moderatorChannelName: string, getRanksForGroup: RankGroup): Promise<ExternalRankEventData | null> {
    const channels = await this.channelService.searchChannelsByName(streamerId, channelName)
    if (channels.length !== 1) {
      return null
    }

    const channel = single(channels)
    const primaryUserId = getPrimaryUserId(channel)
    const channelId = channel.platformInfo.channel.id

    const ranks = await this.rankStore.getUserRanksForGroup(getRanksForGroup, streamerId)
    const punishmentRanksForUser = ranks.filter(r => r.primaryUserId === primaryUserId)

    // we can search a bit more intelligently for moderator channels by reducing the pool of potential matches to actual moderators instead of all users
    const administrationUserRanks = getRanksForGroup === 'administration' ? ranks : await this.rankStore.getUserRanksForGroup('administration', streamerId)
    const modPrimaryUserIds = administrationUserRanks.filter(ur => ur.rank.name === 'mod' || ur.rank.name === 'owner').map(ur => ur.primaryUserId)
    const matchingChannelsForModerator = await this.channelService.searchChannelsByName(streamerId, moderatorChannelName)
    const moderatorChannels = matchingChannelsForModerator.filter(c => modPrimaryUserIds.includes(getPrimaryUserId(c)))
    if (moderatorChannels.length !== 1) {
      this.logService.logInfo(this, `Searched for moderator channel '${channelName}' for streamer ${streamerId} but found ${moderatorChannels.length} matches.`)
    }

    const moderatorChannel = moderatorChannels.length === 1 ? single(moderatorChannels) : null
    const moderatorPrimaryUserId = moderatorChannel != null ? getPrimaryUserId(moderatorChannel) : null

    return { primaryUserId, channelId, ranksForUser: punishmentRanksForUser, moderatorPrimaryUserId }
  }
}
