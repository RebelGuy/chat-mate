import { ChatMessagePart, CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { PartialChatMessage, PartialTextChatMessage, removeRangeFromText } from '@rebel/server/models/chat'
import ExperienceService from '@rebel/server/services/ExperienceService'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'

type SearchResult = {
  searchTerm: string,
  startIndex: number
}

type Deps = Dependencies<{
  customEmojiStore: CustomEmojiStore,
  experienceService: ExperienceService
}>

export default class EmojiService extends ContextClass {
  private readonly customEmojiStore: CustomEmojiStore
  private readonly experienceService: ExperienceService

  constructor (deps: Deps) {
    super()
    this.customEmojiStore = deps.resolve('customEmojiStore')
    this.experienceService = deps.resolve('experienceService')
  }

  /** Analyses the given chat message and inserts custom emojis where applicable. */
  public async applyCustomEmojis (part: PartialChatMessage, channelId: number): Promise<PartialChatMessage[]> {
    if (part.type === 'emoji') {
      // youtube emoji - don't change
      return [part]
    } else if (part.type === 'customEmoji') {
      // this should never happen
      throw new Error('Cannot apply custom emojis to a message part of type PartialCustomEmojiChatMessage')
    }

    const eligibleEmojis = await this.getEligibleEmojis(channelId)
    const searchTerms = eligibleEmojis.map(e => `:${e.symbol}:`)
    const searchResults = this.findMatches(part.text, searchTerms)

    let remainderText: PartialTextChatMessage | null = part
    let result: PartialChatMessage[] = []
    for (const searchResult of searchResults) {
      if (remainderText == null) {
        throw new Error('The remainder text was null')
      }
      const indexShift = remainderText.text.length - part.text.length
      const [leading, removed, trailing] = removeRangeFromText(remainderText, searchResult.startIndex + indexShift, searchResult.searchTerm.length)

      if (leading != null) {
        result.push(leading)
      }

      result.push({
        type: 'customEmoji',
        customEmojiId: eligibleEmojis.find(e => `:${e.symbol}:` === searchResult.searchTerm)!.id,
        text: removed
      })

      remainderText = trailing
    }

    if (remainderText != null) {
      result.push(remainderText)
    }

    return result
  }

  private async getEligibleEmojis (channelId: number): Promise<CustomEmoji[]> {
    const levelPromise = this.experienceService.getLevel(channelId)
    const allEmojis = await this.customEmojiStore.getAllCustomEmojis()
    const level = await levelPromise

    return allEmojis.filter(e => level.level >= e.levelRequirement)
  }

  /** Attempts to match the search terms, ignoring casings. Returns ordered search results. */
  private findMatches (text: string, searchTerms: string[]): SearchResult[] {
    let results: SearchResult[] = []

    text = text.toLowerCase()
    for (let i = 0; i < text.length; i++) {
      for (let j = 0; j < searchTerms.length; j++) {
        const term = searchTerms[j].toLowerCase()
        if (text.substring(i, i + term.length) == term) {
          results.push({ startIndex: i, searchTerm: searchTerms[j] })

          // the next outer loop iteration should start after this match.
          // -1 because the for-loop already increments by 1
          i += term.length - 1
          break
        }
      }
    }

    return results
  }
}