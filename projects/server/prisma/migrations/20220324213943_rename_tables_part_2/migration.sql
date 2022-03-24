/*
  Warnings:

  - You are about to drop the `channel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_custom_emoji` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `experience_transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `viewing_block` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `channel` DROP FOREIGN KEY `Channel_userId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_customEmojiId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_emojiId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_custom_emoji` DROP FOREIGN KEY `chat_custom_emoji_textId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_livestreamId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_twitchChannelId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_userId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message` DROP FOREIGN KEY `chat_message_youtubeChannelId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_chatMessageId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_customEmojiId_fkey`;

-- DropForeignKey
ALTER TABLE `experience_data_admin` DROP FOREIGN KEY `experience_data_admin_experienceTransactionId_fkey`;

-- DropForeignKey
ALTER TABLE `experience_data_chat_message` DROP FOREIGN KEY `experience_data_chat_message_chatMessageId_fkey`;

-- DropForeignKey
ALTER TABLE `experience_data_chat_message` DROP FOREIGN KEY `experience_data_chat_message_experienceTransactionId_fkey`;

-- DropForeignKey
ALTER TABLE `experience_transaction` DROP FOREIGN KEY `experience_transaction_livestreamId_fkey`;

-- DropForeignKey
ALTER TABLE `experience_transaction` DROP FOREIGN KEY `experience_transaction_userId_fkey`;

-- DropForeignKey
ALTER TABLE `viewing_block` DROP FOREIGN KEY `viewing_block_livestreamId_fkey`;

-- DropForeignKey
ALTER TABLE `viewing_block` DROP FOREIGN KEY `viewing_block_userId_fkey`;

-- DropForeignKey
ALTER TABLE `youtube_channel_info` DROP FOREIGN KEY `youtube_channel_info_channelId_fkey`;


RENAME TABLE `channel` TO `youtube_channels`;
ALTER TABLE `youtube_channels` RENAME INDEX `Channel_youtubeId_key` TO `youtube_channels_youtubeId_key`;

RENAME TABLE `chat_custom_emoji` TO `chat_custom_emojis`;
ALTER TABLE `chat_custom_emojis` RENAME INDEX `chat_custom_emoji_textId_key` TO `chat_custom_emojis_textId_key`;

RENAME TABLE `chat_message` TO `chat_messages`;
ALTER TABLE `chat_messages` RENAME INDEX `chat_message_youtubeId_key` TO `chat_messages_youtubeId_key`;

RENAME TABLE `experience_transaction` TO `experience_transactions`;

RENAME TABLE `viewing_block` TO `viewing_blocks`;


-- AddForeignKey
ALTER TABLE `youtube_channel_info` ADD CONSTRAINT `youtube_channel_info_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `youtube_channels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channels` ADD CONSTRAINT `youtube_channels_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emojis` ADD CONSTRAINT `chat_custom_emojis_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emojis`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emojis` ADD CONSTRAINT `chat_custom_emojis_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_custom_emojis` ADD CONSTRAINT `chat_custom_emojis_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `custom_emojis`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `chat_custom_emojis`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_part` ADD CONSTRAINT `chat_message_part_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `Livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_youtubeChannelId_fkey` FOREIGN KEY (`youtubeChannelId`) REFERENCES `youtube_channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_twitchChannelId_fkey` FOREIGN KEY (`twitchChannelId`) REFERENCES `twitch_channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_transactions` ADD CONSTRAINT `experience_transactions_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `Livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_transactions` ADD CONSTRAINT `experience_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_chat_message` ADD CONSTRAINT `experience_data_chat_message_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_chat_message` ADD CONSTRAINT `experience_data_chat_message_experienceTransactionId_fkey` FOREIGN KEY (`experienceTransactionId`) REFERENCES `experience_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experience_data_admin` ADD CONSTRAINT `experience_data_admin_experienceTransactionId_fkey` FOREIGN KEY (`experienceTransactionId`) REFERENCES `experience_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `viewing_blocks` ADD CONSTRAINT `viewing_blocks_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `Livestream`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `viewing_blocks` ADD CONSTRAINT `viewing_blocks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `chat_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
