import ExperienceHelpers, { MULTIPLIER_CHANGE_AT_MAX, MULTIPLIER_CHANGE_AT_MIN, SpamMult, TARGET_CHAT_PERIOD_MAX, TARGET_CHAT_PERIOD_MIN } from '@rebel/server/helpers/ExperienceHelpers'
import { expectStrictIncreasing, nameof } from '@rebel/shared/testUtils'
import * as data from '@rebel/server/_test/testData'
import { ChatItem, ChatItemWithRelations, PartialChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import { asGte, asLt, asLte, asRange, eps } from '@rebel/shared/util/math'
import { addTime } from '@rebel/shared/util/datetime'

const experienceHelpers = new ExperienceHelpers()

describe(nameof(ExperienceHelpers, 'calculateChatMessageQuality'), () => {
  test('empty chat leads to zero quality', () => {
    const result = experienceHelpers.calculateChatMessageQuality(data.chatItem1.messageParts)

    expect(result).toBe(0)
  })

  test('more emojis lead to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(data.chatItem1.messageParts)
    const r1 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(emoji('id1')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(emoji('id1'), emoji('id2')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(emoji('id1'), emoji('id2'), emoji('id3')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('longer text leads to higher quality', () => {
    // this is kind of difficult to test because longer messages lead to longer words, more words, or both,
    // which also affects the score
    const r0 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('a')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('aa')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('aaa')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('aaaa')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('more words lead to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('a a')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('a a a')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('a a a a')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('a a a a a')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('higher average word length leads to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('aa aa aa aa')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('aaaa aaaa aaaa aaaa')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('aaaaaa aaaaaa aaaaaa aaaaaa')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('aaaaaaaa aaaaaaaa aaaaaaaa aaaaaaaa')))

    expectStrictIncreasing(r0, r1, r2, r3)
  })

  test('more unique characters lead to higher quality', () => {
    const r0 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('12340000000')))
    const r1 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('12345600000')))
    const r2 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('12345678000')))
    const r3 = experienceHelpers.calculateChatMessageQuality(getPartialChatMessages(text('123456789ab')))

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

  test('correctly inverts `calculateExperience`', () => {
    const levels = [1, 1.5, 49, 50, 50.1, 50.15, 99.9]

    const xp = levels.map(l => experienceHelpers.calculateExperience({
      level: asGte(Math.floor(l), 0),
      levelProgress: asLt(asGte(l - Math.floor(l), 0), 1)
    }))
    const levelResult = xp.map(x => experienceHelpers.calculateLevel(x))

    expect(levelResult.map(l => l.level + l.levelProgress)).toEqual(levels)
  })
})

describe(nameof(ExperienceHelpers, 'calculateParticipationMultiplier'), () => {
  test('higher participation streaks lead to higher multipliers', () => {
    const m0 = experienceHelpers.calculateParticipationMultiplier(asGte(1, 0))
    const m1 = experienceHelpers.calculateParticipationMultiplier(asGte(2, 0))
    const m2 = experienceHelpers.calculateParticipationMultiplier(asGte(3, 0))
    const m3 = experienceHelpers.calculateParticipationMultiplier(asGte(4, 0))

    expectStrictIncreasing(m0, m1, m2, m3)
  })

  test('capped at 2', () => {
    const m = experienceHelpers.calculateParticipationMultiplier(asGte(100 ,0))

    expect(m).toBe(2)
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

  test('capped at 2', () => {
    const m = experienceHelpers.calculateParticipationMultiplier(asGte(100 ,0))

    expect(m).toBe(2)
  })
})

describe(nameof(ExperienceHelpers, 'calculateRepetitionPenalty'), () => {
  const time1 = new Date().getTime()
  const time2 = new Date().getTime() - 300000
  function generateChatItem (timestamp: number, msg: string): ChatItemWithRelations {
    return {
      id: 1,
      time: new Date(timestamp),
      streamerId: 5,
      userId: 1,
      externalId: 'chat id',
      deletedTime: null,
      youtubeLivestreamId: 1,
      twitchLivestreamId: null,
      contextToken: null,
      youtubeChannelId: 1,
      twitchChannelId: null,
      twitchChannel: null,
      youtubeChannel: { userId: 1, id: 1, youtubeId: 'id', infoHistory: [] },
      donationId: null,
      chatCommand: null,
      user: null,
      chatMessageParts: [{
        id: 1,
        chatMessageId: 1,
        emoji: null,
        emojiId: null,
        order: 1,
        textId: 1,
        text: {
          id: 1,
          isBold: false,
          isItalics: false,
          text: msg
        },
        customEmojiId: null,
        customEmoji: null,
        cheerId: null,
        cheer: null
      }]
    }
  }

  test('returns zero if there are no repeats', () => {
    const chatItems: ChatItemWithRelations[] = [
      generateChatItem(time1, 'test1'),
      generateChatItem(time1, 'test2'),
      generateChatItem(time1, 'test3'),
      generateChatItem(time1, 'test2'),
      generateChatItem(time1, 'test4')
    ]

    const penalty = experienceHelpers.calculateRepetitionPenalty(time1, chatItems)

    expect(penalty).toEqual(0)
  })

  test('returns negative value if there are repeats', () => {
    const chatItems: ChatItemWithRelations[] = [
      generateChatItem(time1, 'test1'),
      generateChatItem(time1, 'test2'),
      generateChatItem(time1, 'test1'),
      generateChatItem(time1, 'test3'),
      generateChatItem(time1, 'test1'),
      generateChatItem(time1, 'test4'),
      generateChatItem(time1, 'test1'),
      generateChatItem(time1, 'test5')
    ]

    const penalty = experienceHelpers.calculateRepetitionPenalty(time1, chatItems)

    expect(penalty).toBeLessThan(0)
  })
})

describe(nameof(ExperienceHelpers, 'calculateSpamMultiplier'), () => {
  const prevMult = 0.5 as SpamMult

  test('multiplier reduced more in negative window', () => {
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
    const time0 = data.time1.getTime()
    const time1 = addTime(data.time1, 'hours', 10).getTime()

    const extremeSpam = experienceHelpers.calculateSpamMultiplier(time0, time0, prevMult)
    const noSpam = experienceHelpers.calculateSpamMultiplier(time1, time0, prevMult)

    expect(extremeSpam).toBe(0.5 * MULTIPLIER_CHANGE_AT_MIN)
    expect(noSpam).toBe(0.5 * MULTIPLIER_CHANGE_AT_MAX)
  })

  test('multiplier is bounded on lower end', () => {
    const prevMultLow = asRange(0.1, 0.1, 1.5)
    const time0 = data.time1.getTime()

    const result = experienceHelpers.calculateSpamMultiplier(time0, time0, prevMultLow)

    expect(result).toBe(prevMultLow)
  })

  test('multiplier is bounded on lower end', () => {
    const prevMultHigh = asRange(1.5, 0.1, 1.5)
    const time0 = data.time1.getTime()
    const time1 = addTime(data.time1, 'hours', 10).getTime()

    const result = experienceHelpers.calculateSpamMultiplier(time1, time0, prevMultHigh)

    expect(result).toBe(prevMultHigh)
  })
})

describe(nameof(ExperienceHelpers, 'calculateExperience'), () => {
  test('higher levels lead to higher experiences', () => {
    const xp1 = experienceHelpers.calculateExperience({ level: 0, levelProgress: asLt(0, 1) })
    const xp2 = experienceHelpers.calculateExperience({ level: 0, levelProgress: asLt(asGte(0.01, 0), 1) })
    const xp3 = experienceHelpers.calculateExperience({ level: asGte(1, 0), levelProgress: asLt(0, 1) })
    const xp4 = experienceHelpers.calculateExperience({ level: asGte(2, 0), levelProgress: asLt(0, 1) })
    const xp5 = experienceHelpers.calculateExperience({ level: asGte(100, 0), levelProgress: asLt(0, 1) })

    expectStrictIncreasing(xp1, xp2, xp3, xp4, xp5)
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

function emoji (url: string): PartialEmojiChatMessage {
  return {
    type: 'emoji',
    image: { url: url },
    label: url + '_label',
    name: url + '_name'
  }
}

function getPartialChatMessages (...msgs: PartialChatMessage[]): PartialChatMessage[] {
  return msgs
}
