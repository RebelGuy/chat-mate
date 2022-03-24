-- RenameIndex
ALTER TABLE `chat_emojis` RENAME INDEX `chat_emoji_youtubeId_key` TO `chat_emojis_youtubeId_key`;

-- RenameIndex
ALTER TABLE `custom_emojis` RENAME INDEX `CustomEmoji_symbol_key` TO `custom_emojis_symbol_key`;
