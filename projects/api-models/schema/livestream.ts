import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { ApiResponse, PublicObject } from '@rebel/api-models/types'

export type GetLivestreamsResponse = ApiResponse<{
  youtubeLivestreams: PublicObject<PublicLivestream>[]
  twitchLivestreams: PublicObject<PublicLivestream>[]
}>
