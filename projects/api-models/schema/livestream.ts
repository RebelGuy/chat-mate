import { PublicAggregateLivestream } from '@rebel/api-models/public/livestream/PublicAggregateLivestream'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { ApiResponse } from '@rebel/api-models/types'

export type GetLivestreamsResponse = ApiResponse<{
  youtubeLivestreams: PublicLivestream[]
  twitchLivestreams: PublicLivestream[]
  aggregateLivestreams: PublicAggregateLivestream[]
}>
