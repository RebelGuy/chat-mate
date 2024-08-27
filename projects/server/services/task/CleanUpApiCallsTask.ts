import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import { ITask } from '@rebel/server/services/task/TaskService'
import PlatformApiStore from '@rebel/server/stores/PlatformApiStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { addTime } from '@rebel/shared/util/datetime'

type Deps = Dependencies<{
  platformApiStore: PlatformApiStore
  dateTimeHelpers: DateTimeHelpers
}>

export default class CleanUpApiCallsTask extends ContextClass implements ITask {
  private readonly platformApiStore: PlatformApiStore
  private readonly dateTimeHelpers: DateTimeHelpers

  constructor (deps: Deps) {
    super()

    this.platformApiStore = deps.resolve('platformApiStore')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
  }

  public async execute (onLog: (logToAppend: string) => void): Promise<string | null> {
    const since = addTime(this.dateTimeHelpers.now(), 'days', -30).getTime()

    const removedMasterchatCalls = await this.platformApiStore.removeSuccessfulRequestsSince(since, 'masterchat[%].fetch')
    if (removedMasterchatCalls > 0) {
      onLog(`Removed ${removedMasterchatCalls} 'masterchat[%].fetch' calls`)
    }

    const removedListBroadcastCalls = await this.platformApiStore.removeSuccessfulRequestsSince(since, 'youtube_v3.liveBroadcasts.list')
    if (removedListBroadcastCalls > 0) {
      onLog(`Removed ${removedListBroadcastCalls} 'youtube_v3.liveBroadcasts.list' calls`)
    }

    return null
  }
}
