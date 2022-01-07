import ExperienceHelpers, { MULTIPLIER_CHANGE_AT_MAX, MULTIPLIER_CHANGE_AT_MIN, TARGET_CHAT_PERIOD_MAX, TARGET_CHAT_PERIOD_MIN } from '@rebel/server/helpers/ExperienceHelpers'
import { expectStrictIncreasing, nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'
import { ChatItem, PartialChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import { asGte, asRange, eps } from '@rebel/server/util/math'
import { addTime } from '@rebel/server/util/datetime'

const experienceHelpers = new ExperienceHelpers()

describe(nameof(ExperienceHelpers, 'calculateChatMessageQuality'), () => {
  test('empty chat leads to zero quality', () => {
    const result = experienceHelpers.calculateChatMessageQuality(data.chatItem1)

    expect(result).toBe(0)
  })

  test('more emojis lead to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(data.chatItem1)
    const r1 = experienceHelpers.calculateChatMessageQuality(getChatItem(emoji('id1')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getChatItem(emoji('id1'), emoji('id2')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getChatItem(emoji('id1'), emoji('id2'), emoji('id3')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('longer text leads to higher quality', () => {
    // this is kind of difficult to test because longer messages lead to longer words, more words, or both,
    // which also affects the score
    const r0 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('a')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('aa')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('aaa')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('aaaa')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('more words lead to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('a a')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('a a a')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('a a a a')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('a a a a a')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('higher average word length leads to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('a a a a')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('aaa aaa aaa aaa')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('aaaaa aaaaa aaaaa aaaaa')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('aaaaaaa aaaaaaa aaaaaaa aaaaaaa')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('more unique characters lead to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('12340000000')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('12345600000')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('12345678000')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getChatItem(text('123456789ab')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })
})

describe(nameof(ExperienceHelpers, 'calculateLevel'), () => {
  test('0 xp returns level 0', () => {
    const level = experienceHelpers.calculateLevel(0)

    expect(level).toEqual({ level: 0, levelProgress: 0 })
  })

  test('higher xp returns higher levels', () => {
    const level0 = experienceHelpers.calculateLevel(asGte(10000, 0)).level
    const level1 = experienceHelpers.calculateLevel(asGte(100000, 0)).level
    const level2 = experienceHelpers.calculateLevel(asGte(1000000, 0)).level
    const level3 = experienceHelpers.calculateLevel(asGte(10000000, 0)).level

    expectStrictIncreasing(level0, level1, level2, level3)
  })

  test('higher xp in a level returns higher progress', () => {
    const progress0 = experienceHelpers.calculateLevel(asGte(12500, 0)).levelProgress
    const progress1 = experienceHelpers.calculateLevel(asGte(12600, 0)).levelProgress
    const progress2 = experienceHelpers.calculateLevel(asGte(12700, 0)).levelProgress
    const progress3 = experienceHelpers.calculateLevel(asGte(12800, 0)).levelProgress

    expectStrictIncreasing(progress0, progress1, progress2, progress3)
  })
})

describe(nameof(ExperienceHelpers, 'calculateParticipationMultiplier'), () => {
  test('higher participation streaks lead to higher multipliers', () => {
    const m0 = experienceHelpers.calculateParticipationMultiplier(asGte(0, 0))
    const m1 = experienceHelpers.calculateParticipationMultiplier(asGte(1, 0))
    const m2 = experienceHelpers.calculateParticipationMultiplier(asGte(2, 0))
    const m3 = experienceHelpers.calculateParticipationMultiplier(asGte(3, 0))

    expectStrictIncreasing(m0, m1, m2, m3)
  })
})

describe(nameof(ExperienceHelpers, 'calculateQualityMultiplier'), () => {
  test('higher quality leads to higher multipliers', () => {
    const m0 = experienceHelpers.calculateQualityMultiplier(asRange(0, 0, 2))
    const m1 = experienceHelpers.calculateQualityMultiplier(asRange(0.5, 0, 2))
    const m2 = experienceHelpers.calculateQualityMultiplier(asRange(1, 0, 2))
    const m3 = experienceHelpers.calculateQualityMultiplier(asRange(1.5, 0, 2))
    const m4 = experienceHelpers.calculateQualityMultiplier(asRange(2, 0, 2))

    expectStrictIncreasing(m0, m1, m2, m3, m4)
  })
})

describe(nameof(ExperienceHelpers, 'calculateSpamMultiplier'), () => {
  test('multiplier reduced more in negative window', () => {
    const prevMult = asRange(0.5, eps, 1)
    const time0 = data.time1.getTime()
    const time1 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MIN / 1000 - 1).getTime()
    const time2 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MIN / 1000 - 2).getTime()
    const time3 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MIN / 1000 - 3).getTime()

    const r1 = experienceHelpers.calculateSpamMultiplier(time1, time0, prevMult)
    const r2 = experienceHelpers.calculateSpamMultiplier(time2, time0, prevMult)
    const r3 = experienceHelpers.calculateSpamMultiplier(time3, time0, prevMult)

    expectStrictIncreasing(r3, r2, r1, prevMult)
  })

  test('multiplier remains same in static window', () => {
    const prevMult = asRange(0.5, eps, 1)
    const time0 = data.time1.getTime()
    const time1 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MIN / 1000).getTime()
    // centre of static window
    const time2 = addTime(data.time1, 'seconds', (TARGET_CHAT_PERIOD_MIN + (TARGET_CHAT_PERIOD_MAX - TARGET_CHAT_PERIOD_MIN) / 2) / 1000).getTime()
    const time3 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MAX / 1000).getTime()

    const r1 = experienceHelpers.calculateSpamMultiplier(time1, time0, prevMult)
    const r2 = experienceHelpers.calculateSpamMultiplier(time2, time0, prevMult)
    const r3 = experienceHelpers.calculateSpamMultiplier(time3, time0, prevMult)

    expect(r1).toBe(prevMult)
    expect(r2).toBe(prevMult)
    expect(r3).toBe(prevMult)
  })

  test('multiplier increases more in positive window', () => {
    const prevMult = asRange(0.5, eps, 1)
    const time0 = data.time1.getTime()
    const time1 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MAX / 1000 + 1).getTime()
    const time2 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MAX / 1000 + 2).getTime()
    const time3 = addTime(data.time1, 'seconds', TARGET_CHAT_PERIOD_MAX / 1000 + 3).getTime()

    const r1 = experienceHelpers.calculateSpamMultiplier(time1, time0, prevMult)
    const r2 = experienceHelpers.calculateSpamMultiplier(time2, time0, prevMult)
    const r3 = experienceHelpers.calculateSpamMultiplier(time3, time0, prevMult)

    expectStrictIncreasing(prevMult, r1, r2, r3)
  })

  test('multiplier delta is bounded', () => {
    const prevMult = asRange(0.5, eps, 1)
    const time0 = data.time1.getTime()
    const time1 = addTime(data.time1, 'hours', 10).getTime()

    const extremeSpam = experienceHelpers.calculateSpamMultiplier(time0, time0, prevMult)
    const noSpam = experienceHelpers.calculateSpamMultiplier(time1, time0, prevMult)

    expect(extremeSpam).toBe(0.5 * MULTIPLIER_CHANGE_AT_MIN)
    expect(noSpam).toBe(0.5 * MULTIPLIER_CHANGE_AT_MAX)
  })

  test('multiplier is bounded on lower end', () => {
    const prevMult = asRange(eps, eps, 1)
    const time0 = data.time1.getTime()

    const result = experienceHelpers.calculateSpamMultiplier(time0, time0, prevMult)

    expect(result).toBe(prevMult)
  })

  test('multiplier is bounded on lower end', () => {
    const prevMult = asRange(1, eps, 1)
    const time0 = data.time1.getTime()
    const time1 = addTime(data.time1, 'hours', 10).getTime()

    const result = experienceHelpers.calculateSpamMultiplier(time1, time0, prevMult)

    expect(result).toBe(prevMult)
  })
})

describe(nameof(ExperienceHelpers, 'calculateViewershipMultiplier'), () => {
  test('higher viewership streaks lead to higher multipliers', () => {
    const m0 = experienceHelpers.calculateViewershipMultiplier(asGte(0, 0))
    const m1 = experienceHelpers.calculateViewershipMultiplier(asGte(1, 0))
    const m2 = experienceHelpers.calculateViewershipMultiplier(asGte(2, 0))
    const m3 = experienceHelpers.calculateViewershipMultiplier(asGte(3, 0))

    expectStrictIncreasing(m0, m1, m2, m3)
  })
})

function text (txt: string): PartialTextChatMessage {
  return {
    type: 'text',
    text: txt,
    isBold: false,
    isItalics: false,
  }
}

function emoji (id: string): PartialEmojiChatMessage {
  return {
    type: 'emoji',
    emojiId: id,
    image: { url: 'test url' },
    label: id + '_label',
    name: id + '_name'
  }
}

function getChatItem (...msgs: PartialChatMessage[]): ChatItem {
  return {
    ...data.chatItem1,
    messageParts: msgs
  }
}
