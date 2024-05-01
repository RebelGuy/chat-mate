import { YTEmoji } from '@rebel/masterchat'
import { EmojiMap } from '@rebel/server/services/EmojiService'
import * as fs from 'fs'

// recovered via view-source:https://www.youtube.com/ as the value to the key "live_chat_unicode_emoji_json_url"
const live_chat_unicode_emoji_json_url = 'https://www.gstatic.com/youtube/img/emojis/emojis-svg-9.json'

// todo: in the future, we can handle the skin-colour variation of emojis (they are included in the emoji map, but most are without a name)
const compoundEmojiMap = {
  '🏻': 'light_skin_tone',
  '🏼': 'medium_light_skin_tone',
  '🏽': 'medium_skin_tone',
  '🏾': 'medium_dark_skin_tone',
  '🏿': 'dark_skin_tone'
}

async function main () {
  const result: YTEmoji[] = await fetch(live_chat_unicode_emoji_json_url).then(r => r.json())

  if (!Array.isArray(result)) {
    throw new Error('Expected an array')
  }

  let emojiMap: EmojiMap = {}

  for (let i = 0; i < result.length; i++) {
    const emoji = result[i]

    if (emoji.emojiId == null) {
      throw new Error('One or more emojis have a null ID')
    } else if (emoji?.image?.thumbnails?.at(0)?.url == null) {
      throw new Error('One or more emojis are missing their URL')
    } else if (emoji.image.accessibility == null && (emoji.searchTerms == null || emoji.shortcuts == null)) {
      // there are some really weird emojis that don't have any labels
      // (e.g. \ud83d\udc68\ud83c\udffd\u200d\u2764\u200d\ud83d\udc8b\u200d\ud83d\udc68\ud83c\udfff... look it up, i dare you
      // https://www.youtube.com/s/gaming/emoji/7ff574f2/emoji_u1f468_1f3fd_200d_2764_200d_1f48b_200d_1f468_1f3ff.svg).
      // these emojis seem to be composites of other emojis. oftentimes, we see a facial emoji followed by a skin colour emoji.
      // don't include them in the map, since we won't be able to generate a proper YTEmoji object from them
      console.log(`Skipping emoji ${i} (${emoji.emojiId})`)
    } else {
      emojiMap[emoji.emojiId] = emoji
    }
  }

  console.log(`Keeping ${Object.keys(emojiMap).length} emojis. Saving to emojiMap.json`)

  // write it to the chat-mate root folder
  fs.writeFileSync('../../emojiMap.json', JSON.stringify(emojiMap))
}

void main()
