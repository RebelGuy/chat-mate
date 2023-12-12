import AggregateLivestream from '@rebel/server/models/AggregateLivestream'
import { cast, nameof } from '@rebel/shared/testUtils'
import * as data from '@rebel/server/_test/testData'
import { TwitchLivestream, YoutubeLivestream } from '@prisma/client'

const twitchLivestreams = cast<TwitchLivestream[]>([{ id: 1 }, { id: 2 }])
const youtubeLivestreams = cast<YoutubeLivestream[]>([{ id: 3, liveId: 'id3' }, { id: 4, liveId: 'id4 '}])
const livestreamData = 123
const aggregateLivestream = new AggregateLivestream(data.time2, data.time3, [...twitchLivestreams, ...youtubeLivestreams], livestreamData)

describe(nameof(AggregateLivestream, 'getYoutubeLivestreams'), () => {
  test('Returns the Youtube livestreams', () => {
    const result = aggregateLivestream.getYoutubeLivestreams()

    expect(result).toEqual(youtubeLivestreams)
  })
})

describe(nameof(AggregateLivestream, 'getTwitchLivestreams'), () => {
  test('Returns the Twitch livestreams', () => {
    const result = aggregateLivestream.getTwitchLivestreams()

    expect(result).toEqual(twitchLivestreams)
  })
})

describe(nameof(AggregateLivestream, 'includesLivestream'), () => {
  test('Returns true if the specified Youtube livestream is included', () => {
    const result = aggregateLivestream.includesLivestream(3, 'youtube')

    expect(result).toBe(true)
  })

  test('Returns false if the specified Youtube livestream is not included', () => {
    const result = aggregateLivestream.includesLivestream(2, 'youtube')

    expect(result).toBe(false)
  })

  test('Returns true if the specified Twitch livestream is included', () => {
    const result = aggregateLivestream.includesLivestream(2, 'twitch')

    expect(result).toBe(true)
  })

  test('Returns false if the specified Twitch livestream is not included', () => {
    const result = aggregateLivestream.includesLivestream(3, 'twitch')

    expect(result).toBe(false)
  })
})

describe(nameof(AggregateLivestream, 'includesTimestamp'), () => {
  test('Returns true if the given timestamp is within the livestream time', () => {
    const result = aggregateLivestream.includesTimestamp(data.time2.getTime() + 1000)

    expect(result).toBe(true)
  })

  test('Returns true if the given timestamp is within the livestream time for a still active livestream', () => {
    const activeAggregateLivestream = new AggregateLivestream(data.time2, null, [...twitchLivestreams, ...youtubeLivestreams], livestreamData)

    const result = activeAggregateLivestream.includesTimestamp(data.time4.getTime())

    expect(result).toBe(true)
  })

  test('Returns false if the given timestamp is before the livestream time', () => {
    const result = aggregateLivestream.includesTimestamp(data.time1.getTime())

    expect(result).toBe(false)
  })

  test('Returns false if the given timestamp is before the livestream time', () => {
    const result = aggregateLivestream.includesTimestamp(data.time4.getTime())

    expect(result).toBe(false)
  })
})

describe(nameof(AggregateLivestream, 'withDataReplaced'), () => {
  test('Creates a new instance with the specified data', () => {
    const result = aggregateLivestream.withDataReplaced(456)

    expect(result).not.toBe(aggregateLivestream)
    expect(result.data).toBe(456)
  })
})
