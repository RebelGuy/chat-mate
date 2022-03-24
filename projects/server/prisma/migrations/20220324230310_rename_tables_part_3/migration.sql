/*
  Warnings:

  - You are about to drop the `chat_message_part` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `livestream` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_chatMessageId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_cheerId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_customEmojiId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_emojiId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_message_part` DROP FOREIGN KEY `chat_message_part_textId_fkey`;

-- DropForeignKey
ALTER TABLE `chat_messages` DROP FOREIGN KEY `chat_messages_livestreamId_fkey`;

-- DropForeignKey
ALTER TABLE `experience_transactions` DROP FOREIGN KEY `experience_transactions_livestreamId_fkey`;

-- DropForeignKey
ALTER TABLE `live_viewers` DROP FOREIGN KEY `live_viewers_livestreamId_fkey`;

-- DropForeignKey
ALTER TABLE `viewing_blocks` DROP FOREIGN KEY `viewing_blocks_livestreamId_fkey`;

RENAME TABLE `chat_message_part` TO `chat_message_parts`;
ALTER TABLE `chat_message_parts` RENAME INDEX `chat_message_part_textId_key` TO `chat_message_parts_textId_key`;
ALTER TABLE `chat_message_parts` RENAME INDEX `chat_message_part_cheerId_key` TO `chat_message_parts_cheerId_key`;
ALTER TABLE `chat_message_parts` RENAME INDEX `chat_message_part_order_chatMessageId_key` TO `chat_message_parts_order_chatMessageId_key`;

RENAME TABLE `livestream` TO `livestreams`;
ALTER TABLE `livestreams` RENAME INDEX `livestream_liveId_key` TO `livestreams_liveId_key`;

-- AddForeignKey
ALTER TABLE `live_viewers` ADD CONSTRAINT `live_viewers_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestreams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_parts` ADD CONSTRAINT `chat_message_parts_emojiId_fkey` FOREIGN KEY (`emojiId`) REFERENCES `chat_emojis`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_parts` ADD CONSTRAINT `chat_message_parts_textId_fkey` FOREIGN KEY (`textId`) REFERENCES `chat_text`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_parts` ADD CONSTRAINT `chat_message_parts_cheerId_fkey` FOREIGN KEY (`cheerId`) REFERENCES `chat_cheers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_parts` ADD CONSTRAINT `chat_message_parts_customEmojiId_fkey` FOREIGN KEY (`customEmojiId`) REFERENCES `chat_custom_emojis`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_message_parts` ADD CONSTRAINT `chat_message_parts_chatMessageId_fkey` FOREIGN KEY (`chatMessageId`) REFERENCES `chat_messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- (residual)
-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestreams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- (residual)
-- AddForeignKey
ALTER TABLE `experience_transactions` ADD CONSTRAINT `experience_transactions_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestreams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- (residual)
-- AddForeignKey
ALTER TABLE `viewing_blocks` ADD CONSTRAINT `viewing_blocks_livestreamId_fkey` FOREIGN KEY (`livestreamId`) REFERENCES `livestreams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
