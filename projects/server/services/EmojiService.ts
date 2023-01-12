import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { PartialChatMessage, PartialTextChatMessage, removeRangeFromText } from '@rebel/server/models/chat'
import AccountService from '@rebel/server/services/AccountService'
import CustomEmojiEligibilityService from '@rebel/server/services/CustomEmojiEligibilityService'
import { CurrentCustomEmoji } from '@rebel/server/stores/CustomEmojiStore'

type SearchResult = {
  searchTerm: string,
  startIndex: number
}

type Deps = Dependencies<{
  customEmojiEligibilityService: CustomEmojiEligibilityService
  accountService: AccountService
}>

export default class EmojiService extends ContextClass {
  private readonly customEmojiEligibilityService: CustomEmojiEligibilityService
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super()
    this.customEmojiEligibilityService = deps.resolve('customEmojiEligibilityService')
    this.accountService = deps.resolve('accountService')
  }

  /** Analyses the given chat message and inserts custom emojis where applicable. */
  public async applyCustomEmojis (part: PartialChatMessage, defaultUserId: number, streamerId: number): Promise<PartialChatMessage[]> {
    const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser(defaultUserId)
    const eligibleEmojis = await this.customEmojiEligibilityService.getEligibleEmojis(primaryUserId, streamerId)
    return this.applyEligibleEmojis(part, eligibleEmojis)
  }

  public async applyCustomEmojisToDonation (text: string, streamerId: number): Promise<PartialChatMessage[]> {
    const eligibleEmojis = await this.customEmojiEligibilityService.getEligibleDonationEmojis(streamerId)
    const part: PartialTextChatMessage = { type: 'text', text: text, isBold: false, isItalics: false }
    return this.applyEligibleEmojis(part, eligibleEmojis)
  }

  private applyEligibleEmojis (part: PartialChatMessage, eligibleEmojis: CurrentCustomEmoji[]): PartialChatMessage[] {
    if (part.type === 'customEmoji') {
      // this should never happen
      throw new Error('Cannot apply custom emojis to a message part of type PartialCustomEmojiChatMessage')
    }

    // ok I don't know what the proper way to do this is, but typing `:troll:` in YT will convert the message
    // into a troll emoji of type text... so I guess if the troll emoji is available, we add a special rule here
    const troll = eligibleEmojis.find(em => em.symbol.toLowerCase() === 'troll')
    if (troll != null) {
      const secondaryTrollEmoji: CurrentCustomEmoji = { ...troll, symbol: '🧌' }
      eligibleEmojis = [...eligibleEmojis, secondaryTrollEmoji]
    }

    const searchTerms = eligibleEmojis.map(getSymbolToMatch)

    if (part.type === 'emoji') {
      // youtube emoji - check if it has the same symbol (label) as one of our custom emojis.
      // this is an all-or-none match, so we don't need to split up the message part.
      // note that this does not work if a youtube emoji has multiple labels and our custom emoji symbol
      // is not the same as the shortest labels.
      const matchedIndex = searchTerms.findIndex(sym => sym.toLowerCase() === part.label.toLowerCase())
      if (matchedIndex === -1) {
        return [part]
      } else {
        return [{
          type: 'customEmoji',
          customEmojiId: eligibleEmojis[matchedIndex]!.id,
          customEmojiVersion: eligibleEmojis[matchedIndex]!.latestVersion,
          text: null,
          emoji: part
        }]
      }
    } else if (part.type === 'cheer') {
      return [part]
    }

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
        customEmojiId: eligibleEmojis.find(e => getSymbolToMatch(e) === searchResult.searchTerm)!.id,
        customEmojiVersion: eligibleEmojis.find(e => getSymbolToMatch(e) === searchResult.searchTerm)!.latestVersion,
        text: removed,
        emoji: null
      })

      remainderText = trailing
    }

    if (remainderText != null) {
      result.push(remainderText)
    }

    return result
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

// includes the troll hack, as above
function getSymbolToMatch (customEmoji: CustomEmoji): string {
  return customEmoji.symbol === '🧌' ? '🧌' : `:${customEmoji.symbol}:`
}
