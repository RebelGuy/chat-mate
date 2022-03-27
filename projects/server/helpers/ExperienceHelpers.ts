import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItem, PartialTextChatMessage, PartialEmojiChatMessage, ChatItemWithRelations, PartialCustomEmojiChatMessage, PARTIAL_MESSAGE_TYPES } from '@rebel/server/models/chat'
import { tally, unique } from '@rebel/server/util/arrays'
import { NumRange, clampNorm, scaleNorm, clamp, avg, sum, GreaterThanOrEqual, asRange, asGte, LessThan, asLt, LessThanOrEqual, GreaterThan, asLte, asGt } from '@rebel/server/util/math'
import { assertUnreachable, assertUnreachableCompile } from '@rebel/server/util/typescript'

// if chat rate is between lowest and min target values, the reward multiplier will decrease.
// if chat rate is between max target and highest values, the reward multiplier will increase.
// the increase/decrease is scaled linearly, and is applied to the *previous* chat multiplier.
export const TARGET_CHAT_PERIOD_MIN = 3 * 60 * 1000
export const TARGET_CHAT_PERIOD_MAX = 3.5 * 60 * 1000
export const LOWEST_CHAT_PERIOD = 1 * 1000
export const HIGHEST_CHAT_PERIOD = 6 * 60 * 1000
export const MULTIPLIER_CHANGE_AT_MIN = 0.975
export const MULTIPLIER_CHANGE_AT_MAX = 1.05

export type LevelData = { level: GreaterThanOrEqual<0>, levelProgress: GreaterThanOrEqual<0> & LessThan<1> }

export type SpamMult = NumRange<0.1, 1.5>

export type RepetitionPenalty = NumRange<-2, 0>

export default class ExperienceHelpers extends ContextClass {
  // intedned as a safeguard against people trying to spam messages for XP.
  // If chat messages are too fast, the multiplier will tend towards zero.
  // If chat messages are slow enough, the multiplier will slowly regenerate back to 1.
  // It uses only messages times, no contents (see getChatMessageQuality).
  public calculateSpamMultiplier (currentTimestamp: number, prevTimestamp: number, prevMultiplier: SpamMult): SpamMult {
    const deltaT = currentTimestamp - prevTimestamp
    let multiplierMultiplier = 1
    if (deltaT < TARGET_CHAT_PERIOD_MIN) {
      const norm = clampNorm(deltaT, LOWEST_CHAT_PERIOD, TARGET_CHAT_PERIOD_MIN)
      multiplierMultiplier = scaleNorm(norm, MULTIPLIER_CHANGE_AT_MIN, 1)
    } else if (deltaT > TARGET_CHAT_PERIOD_MAX) {
      const norm = clampNorm(deltaT, TARGET_CHAT_PERIOD_MAX, HIGHEST_CHAT_PERIOD)
      multiplierMultiplier = scaleNorm(norm, 1, MULTIPLIER_CHANGE_AT_MAX)
    }

    return clamp(prevMultiplier * multiplierMultiplier, 0.1, 1.5)
  }

  /** Returns a penalty that is to be subtracted from the final multiplier. It is based on the given messages */
  public calculateRepetitionPenalty (currentTimestamp: number, prevMessages: ChatItemWithRelations[]): RepetitionPenalty {
    const text = prevMessages
      .map(item => ({ text: this.chatItemToString(item), age: currentTimestamp - item.time.getTime() }))
      .filter(item => item.age < 60000) // from within the last minute

    const freq = tally(text, (item1, item2) => item1.text === item2.text)

    let penalty = 0
    for (const item of freq) {
      if (item.count <= 3) {
        break
      }

      penalty -= (item.count - 3) * 0.2
    }

    return clamp(penalty, -2, 0)
  }

  private chatItemToString (item: ChatItemWithRelations) {
    if (PARTIAL_MESSAGE_TYPES !== 'text' && PARTIAL_MESSAGE_TYPES !== 'emoji' && PARTIAL_MESSAGE_TYPES !== 'customEmoji' && PARTIAL_MESSAGE_TYPES !== 'cheer') {
      assertUnreachableCompile(PARTIAL_MESSAGE_TYPES)
    }

    // ignore cheer parts, they can't be converted to text
    return item.chatMessageParts.filter(p => !(p.emoji == null && p.text == null && p.customEmoji == null && p.cheer != null))
      .map(p => {
        if (p.emoji != null && p.text == null && p.customEmoji == null && p.cheer == null) {
          return p.emoji.name
        } else if (p.emoji == null && p.text != null && p.customEmoji == null && p.cheer == null) {
          return p.text.text
        } else if (p.emoji == null && p.text == null && p.customEmoji != null && p.cheer == null) {
          return p.customEmoji.customEmoji.symbol
        } else {
          throw new Error('ChatMessagePart must have either an emoji, custom emoji, or text attached to it')
        }
      }).join('')
  }

  // Returns 0 <= x < 1 for low-quality messages, and 1 < x <= 2 for high quality messages. 1 is "normal" quality.
  public calculateChatMessageQuality (chatItem: ChatItem): NumRange<0, 2> {
    const text = chatItem.messageParts
      .filter(p => p.type === 'text' && p.text.trim().length > 0)
      .map(p => (p as PartialTextChatMessage).text.trim().toLowerCase())
    const msg = text.join()
    const words = msg.split(' ')

    const emojis = chatItem.messageParts.filter(p => p.type === 'emoji' || p.type === 'customEmoji')
      .map(part => part.type === 'emoji' ? part.name : part.type === 'customEmoji' ? part.customEmojiId : null)

    // immediately we can filter out spammy messages
    if (text.length === 0 && emojis.length === 0) {
      // empty message
      return asRange(0, 0, 2)
    } else if (text.length === 0) {
      // emoji only
      const uniqueEmojiCount = unique(emojis).length
      const quality = clampNorm(uniqueEmojiCount, 0, 10, 0) * 0.8
      return asRange(quality, 0, 2)
    }

    // the upper end should not be growing linearly so it is easier to get higher length points.
    // upper end goes from log(1) to log(e).
    const lengthQualityRaw = clampNorm(msg.length, 1, 200, 10) * 2
    const lengthQuality = lengthQualityRaw < 1 ? lengthQualityRaw : Math.log(1 + (Math.exp(1) - 1) * (lengthQualityRaw - 1))

    // let's say 30 words is maximum "quality"
    const wordCountQuality = clampNorm(words.length, 1, 30, 8) * 2

    // let's say average word length of 10 is maximum "quality"
    const avgWordLength = sum(words.map(w => w.length)) / words.length
    const wordLengthQuality = clampNorm(avgWordLength, 1, 10) * 2

    // let's say anything under 5 unique characters is "bad", and 15 unique characters is maximum "quality"
    const uniqueCharacters = unique(Array.from(msg.replace(' ', '').toLowerCase())).length
    const uniqueCharactersQuality = clampNorm(uniqueCharacters, 1, 20, 8) * 2

    const uniqueEmojis = unique(emojis).length
    const emojiQuality = clampNorm(uniqueEmojis, 0, 10, 0) * 2

    return asRange(avg(lengthQuality, wordCountQuality, wordLengthQuality, uniqueCharactersQuality, emojiQuality)!, 0, 2)
  }

  public calculateParticipationMultiplier (participationWalkingScore: GreaterThanOrEqual<0>): GreaterThanOrEqual<1> {
    return asGte(1 + 0.05 * Math.max(0, participationWalkingScore - 1), 1)
  }

  public calculateViewershipMultiplier (viewershipWalkingScore: GreaterThanOrEqual<0>): GreaterThanOrEqual<1> {
    return asGte(1 + 0.05 * Math.max(0, viewershipWalkingScore - 1), 1)
  }

  public calculateQualityMultiplier (messageQuality: NumRange<0, 2>): NumRange<0, 2> {
    return messageQuality
  }

  /** Accepts a fractional value. */
  public calculateLevel (experience: GreaterThanOrEqual<0>): LevelData {
    const levelFrac = this.calculateLevel0to50(experience) ?? this.calculateLevel50upwards(experience)
    if (levelFrac == null) {
      throw new Error(`Unable to calculate level for experience ${experience}`)
    }

    const roundedLevel = asGte(Math.floor(levelFrac), 0)
    const thisLevelXp = this.calculateExperience({ level: roundedLevel, levelProgress: asLt(0, 1) })
    const nextLevelXp = this.calculateExperience({ level: asGte(roundedLevel + 1, 0), levelProgress: asLt(0, 1) })
    return {
      level: roundedLevel,
      levelProgress: asLt(asGte((experience - thisLevelXp) / (nextLevelXp - thisLevelXp), 0), 1)
    }
  }

  private calculateLevel0to50 (experience: number): number | null {
    // We want to go for a quadratic increase.
    // 10 per second, 2 hours livestream ~ 100k
    // 100 "good" messages per livestream ~ 100k
    // So about 200k per person per livestream
    // Say at that rate it should be possibl for a new viewer to get to level 5
    // So about 40k per level

    // c is 0 because we want 0 experience <==> level 0
    // So a*25 + b*5 = 200k
    // a * 5 + b = 40k
    //         a = 8k - b / 5, and a, b > 0
    // Let b = 10k. Then a = 6k.

    // Assuming the above yield, number of livestream to get to each of the following levels:
    // 20: 13
    // 40: 50
    // 60: 111
    // 80: 196
    // 100: 305
    // Actually legitimate, considering there will also be bonuses over time!

    // turns out as at v1.5 the highest experience collected is only about 150k
    const scale = 1 / 20
    const a = 6_000 * scale
    const b = 10_000 * scale
    const c = -experience

    // can disregard the `-` case because it would lead to a negative numerator, and the denominator is always positive
    const levelFrac = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
    return levelFrac <= 50 ? levelFrac : null
  }

  private calculateLevel50upwards (experience: number): number | null {
    // I don't think there is an analytical solution to E = cx^3 + ex + f, so use the bisection algorithm.
    // This is safe because the function is increasing monotonically, so we know we will always get a solution

    const validator = (fractionalLevel: number) => {
      const level = asGte(Math.floor(fractionalLevel), 0)
      const levelProgress = asLt(asGte(fractionalLevel - level, 0), 1)
      // if the maybeLevel is too high, the result will be negative
      return experience - this.calculateExperience({ level, levelProgress })
    }
    const level = this.applyBisection(50, 200, 500, validator)
    return level
  }

  /** May return a **fractional** value - the caller is responsible for rounding. */
  public calculateExperience (levelData: LevelData): GreaterThanOrEqual<0> {
    const { level, levelProgress } = levelData
    const xpAtLevel = this.calculateExperienceForIntegerLevel(level)
    const xpAtNextLevel = this.calculateExperienceForIntegerLevel(level + 1)
    const xpFrac = levelProgress * (xpAtNextLevel - xpAtLevel) + xpAtLevel

    return asGte(Math.max(0, xpFrac), 0)
  }

  private calculateExperienceForIntegerLevel (level: number): number {
    if (level <= 50) {
      return this.calculateExperience0to50(asLte(level, 50))
    } else {
      return this.calculateExperience50upwards(asGt(level, 50))
    }
  }

  private calculateExperience0to50 (levelFrac: LessThanOrEqual<50>): number {
    const scale = 1 / 20
    const a = 6_000 * scale
    const b = 10_000 * scale

    const xpFrac = a * levelFrac * levelFrac + b * levelFrac
    return xpFrac
  }

  private calculateExperience50upwards (levelFrac: GreaterThan<50>): number {
    const scale = 1 / 20
    const a = 6_000 * scale
    const b = 10_000 * scale

    const c = 10
    const e = 100 * a + b - 7500 * c
    const f = 250000 * c - 2500 * a

    const xpFrac = c * levelFrac * levelFrac * levelFrac + e * levelFrac + f
    return xpFrac
  }

  /** Iteratively attempts to find the value such that the validator returns 0.
   * If the validator returns a negative value, will next try a lower value.
   * If the validator returns a positive value, will next try a larger value.  */
  private applyBisection (min: number, max: number, maxSteps: number, validator: (value: number) => number): number | null {
    const eps = 1e-6
    let bottom = min
    let top = max

    let step = 0
    while (step < maxSteps) {
      step++
      const value = (top + bottom) / 2
      const result = validator(value)

      if (Math.abs(result) < eps || Math.abs(top - bottom) < eps) {
        return value
      } else if (result < 0) {
        // use lower half
        top = value
      } else if (result > 0) {
        // use upper half
        bottom = value
      }
    }

    return null
  }
}
