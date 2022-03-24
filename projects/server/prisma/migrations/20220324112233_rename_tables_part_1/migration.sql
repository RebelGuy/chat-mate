/*
  Warnings:

  - You are about to drop the `channel_info` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_emoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customemoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `experience_snapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `liveviewers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `channel_info` DROP FOREIGN KEY `channel_info_channelId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_customEmojiId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_emojiId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_emojiId_fkey`;

-- DropForeignKey
ALTER TABLE `experience_snapshot` DROP FOREIGN KEY `experience_snapshot_userId_fkey`;

-- DropForeignKey
ALTER TABLE `liveviewers` DROP FOREIGN KEY `LiveViewers_livestreamId_fkey`;


RENAME TABLE `channel_info` TO `youtube_channel_info`;
RENAME TABLE `chat_emoji` TO `chat_emojis`;
RENAME TABLE `customemoji` TO `custom_emojis`;
RENAME TABLE `experience_snapshot` TO `experience_snapshots`;
RENAME TABLE `liveviewers` TO `live_viewers`;


-- AddForeignKey
ALTER TABLE `live_viewers` ADD CONSTRAINT `live_viewers_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `Livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channel_info` ADD CONSTRAINT `youtube_channel_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emojis`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emoji` ADD CONSTRAINT `chat_custom_emoji_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `custom_emojis`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emojis`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_snapshots` ADD CONSTRAINT `experience_snapshots_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
